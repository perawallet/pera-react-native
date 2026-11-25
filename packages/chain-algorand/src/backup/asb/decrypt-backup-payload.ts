/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { zeroBytes } from '@perawallet/wallet-core-kms'
import {
    decodeBoundedBase64,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { algo25AddressOfKey, decodePrivateKeyBytes } from '../decode-key-bytes'
import { backupIndicesToKey, generateBackupCipherKey } from './asb-crypto'
import {
    SecureBackupAccountKind,
    SecureBackupErrorReason,
    SecureBackupImportError,
    secretboxOpenWithPrependedNonce,
    type SecureBackupAccount,
    type SecureBackupEnvelope,
    type SecureBackupPayload,
} from '@perawallet/wallet-core-backup'

// Defence-in-depth cap on the encrypted payload before decode/decrypt/parse.
// The decrypted plaintext is never larger than the ciphertext, so this also
// bounds the downstream JSON.parse. Generous relative to any real backup.
const MAX_ASB_CIPHERTEXT_BYTES = 5 * 1024 * 1024

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

const isNonEmptyString = (value: unknown): value is string =>
    isString(value) && value.length > 0

const ACCOUNT_KIND_VALUES: readonly SecureBackupAccountKind[] = [
    SecureBackupAccountKind.Single,
    SecureBackupAccountKind.Watch,
]

const isSecureBackupAccountKind = (
    value: unknown,
): value is SecureBackupAccountKind =>
    ACCOUNT_KIND_VALUES.includes(value as SecureBackupAccountKind)

type ParsedAccount = {
    account: SecureBackupAccount
    /** The row's key derives another address than the one it declares. */
    isRebound: boolean
}

const parseAccount = (raw: unknown): Nullable<ParsedAccount> => {
    if (!isPlainObject(raw)) return null

    const { address, account_type, name, private_key } = raw
    if (
        !isNonEmptyString(address) ||
        !isSecureBackupAccountKind(account_type)
    ) {
        return null
    }

    let privateKey: Nullable<Uint8Array> = null
    let keyAddress = address
    if (account_type === SecureBackupAccountKind.Single) {
        if (!isNonEmptyString(private_key)) return null
        // ARC-35 always emits base64; we don't pass
        // `allowCommaSeparated: true` since that legacy format was
        // Pera-Web-specific.
        const decoded = decodePrivateKeyBytes(private_key)
        if (!decoded) return null
        try {
            keyAddress = algo25AddressOfKey(decoded)
            privateKey = decoded.slice()
        } finally {
            zeroBytes(decoded)
        }
    }

    // A legacy Android rekeyed account kept its auth key under the rekeyed
    // address. The selection screen shows `address`, so such a row is listed
    // as the account its key imports, without the name it declared.
    const isRebound = keyAddress !== address
    return {
        account: {
            address: keyAddress,
            name: !isRebound && isNonEmptyString(name) ? name : null,
            kind: account_type,
            privateKey,
        },
        isRebound,
    }
}

/** A rebound row whose key another row already lists is dropped. */
const withoutDuplicateRebounds = (
    parsed: readonly ParsedAccount[],
): SecureBackupAccount[] => {
    const listed = new Set(
        parsed.filter(p => !p.isRebound).map(p => p.account.address),
    )
    return parsed.flatMap(({ account, isRebound }) => {
        if (!isRebound) return [account]
        if (listed.has(account.address)) {
            zeroBytes(account.privateKey)
            return []
        }
        listed.add(account.address)
        return [account]
    })
}

/**
 * Decrypt + decode an ARC-35 backup payload using the user's 12-word recovery
 * phrase. Throws `SecureBackupImportError` for every user-fixable failure mode
 * so the UI can map a single error type to localized copy.
 *
 * Account-level shape errors (missing fields, unknown `account_type`, malformed
 * base64 key) are silently dropped: a single broken row should not block
 * recovery of the rest of the wallet. Empty result is reported as
 * `MalformedPayload`.
 *
 * Secure-memory contract:
 *   - `seed`, `cipherKey`, and `plaintext` are zeroed in `finally`. These are
 *     the only buffers the parser owns; the per-account `privateKey` arrays
 *     in the returned payload survive until the caller is done with them
 *     (see `useAsbAccountImport`).
 *   - The JSON-parsed object and the base64-encoded `private_key` strings
 *     inside it are immutable JS strings — we can't wipe them, but we drop
 *     references as soon as possible so GC can. The recovery phrase itself
 *     arrives as wordlist indices (caller-owned, caller-zeroed), never a
 *     string.
 */
export const decryptBackupPayload = (
    envelope: SecureBackupEnvelope,
    recoveryIndices: Uint16Array,
): SecureBackupPayload => {
    let seed: Nullable<Uint8Array> = null
    let cipherKey: Nullable<Uint8Array> = null
    let plaintext: Nullable<Uint8Array> = null

    try {
        try {
            seed = backupIndicesToKey(recoveryIndices)
        } catch {
            throw new SecureBackupImportError(
                SecureBackupErrorReason.InvalidRecoveryKey,
            )
        }

        cipherKey = generateBackupCipherKey(seed)

        let ciphertext: Uint8Array
        try {
            ciphertext = decodeBoundedBase64(
                envelope.ciphertext,
                MAX_ASB_CIPHERTEXT_BYTES,
                'asb ciphertext',
            )
        } catch {
            throw new SecureBackupImportError(
                SecureBackupErrorReason.MalformedEnvelope,
            )
        }

        plaintext = secretboxOpenWithPrependedNonce(ciphertext, cipherKey)
        if (!plaintext) {
            throw new SecureBackupImportError(
                SecureBackupErrorReason.DecryptionFailed,
            )
        }

        let parsed: unknown
        try {
            parsed = JSON.parse(new TextDecoder().decode(plaintext))
        } catch {
            throw new SecureBackupImportError(
                SecureBackupErrorReason.MalformedPayload,
            )
        }

        if (!isPlainObject(parsed) || !Array.isArray(parsed.accounts)) {
            throw new SecureBackupImportError(
                SecureBackupErrorReason.MalformedPayload,
            )
        }

        const accounts = withoutDuplicateRebounds(
            parsed.accounts.flatMap(row => parseAccount(row) ?? []),
        )

        if (accounts.length === 0) {
            throw new SecureBackupImportError(
                SecureBackupErrorReason.MalformedPayload,
            )
        }

        const providerName = isNonEmptyString(parsed.provider_name)
            ? parsed.provider_name
            : null
        const deviceId = isNonEmptyString(parsed.device_id)
            ? parsed.device_id
            : null

        return { accounts, providerName, deviceId }
    } finally {
        // Best-effort wipe. The base64 private-key strings inside `parsed`
        // are out of reach (immutable), but the binary buffers we owned
        // here — entropy, cipher key, decrypted plaintext — are gone now.
        zeroBytes(seed, cipherKey, plaintext)
    }
}
