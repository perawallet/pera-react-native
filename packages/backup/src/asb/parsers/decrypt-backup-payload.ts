/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import {
    asbSecretboxOpen,
    backupMnemonicToKey,
    generateBackupCipherKey,
} from '../crypto'
import { AsbImportError, AsbErrorReason } from '../errors'
import {
    AsbAccountKind,
    type AsbBackupAccount,
    type AsbBackupEnvelope,
    type AsbBackupPayload,
} from '../models'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

const isNonEmptyString = (value: unknown): value is string =>
    isString(value) && value.length > 0

const ACCOUNT_KIND_VALUES: readonly AsbAccountKind[] = [
    AsbAccountKind.Single,
    AsbAccountKind.Watch,
]

const isAsbAccountKind = (value: unknown): value is AsbAccountKind =>
    ACCOUNT_KIND_VALUES.includes(value as AsbAccountKind)

const parseAccount = (raw: unknown): AsbBackupAccount | null => {
    if (!isPlainObject(raw)) return null

    const { address, account_type, name, private_key } = raw
    if (!isNonEmptyString(address) || !isAsbAccountKind(account_type)) {
        return null
    }

    let privateKey: Uint8Array | null = null
    if (account_type === AsbAccountKind.Single) {
        if (!isNonEmptyString(private_key)) return null
        try {
            privateKey = decodeFromBase64(private_key)
        } catch {
            return null
        }
    }

    return {
        address,
        name: isNonEmptyString(name) ? name : null,
        kind: account_type,
        privateKey,
    }
}

/**
 * Decrypt + decode an ARC-35 backup payload using the user's 12-word recovery
 * phrase. Throws `AsbImportError` for every user-fixable failure mode so the
 * UI can map a single error type to localized copy.
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
 *   - The mnemonic string, the JSON-parsed object, and the base64-encoded
 *     `private_key` strings inside it are immutable JS strings — we can't
 *     wipe them, but we drop references as soon as possible so GC can.
 */
export const decryptBackupPayload = (
    envelope: AsbBackupEnvelope,
    recoveryMnemonic: string,
): AsbBackupPayload => {
    let seed: Uint8Array | null = null
    let cipherKey: Uint8Array | null = null
    let plaintext: Uint8Array | null = null

    try {
        try {
            seed = backupMnemonicToKey(recoveryMnemonic)
        } catch {
            throw new AsbImportError(AsbErrorReason.InvalidRecoveryKey)
        }

        cipherKey = generateBackupCipherKey(seed)

        let ciphertext: Uint8Array
        try {
            ciphertext = decodeFromBase64(envelope.ciphertext)
        } catch {
            throw new AsbImportError(AsbErrorReason.MalformedEnvelope)
        }

        plaintext = asbSecretboxOpen(ciphertext, cipherKey)
        if (!plaintext) {
            throw new AsbImportError(AsbErrorReason.DecryptionFailed)
        }

        let parsed: unknown
        try {
            parsed = JSON.parse(new TextDecoder().decode(plaintext))
        } catch {
            throw new AsbImportError(AsbErrorReason.MalformedPayload)
        }

        if (!isPlainObject(parsed) || !Array.isArray(parsed.accounts)) {
            throw new AsbImportError(AsbErrorReason.MalformedPayload)
        }

        const accounts: AsbBackupAccount[] = []
        for (const row of parsed.accounts) {
            const account = parseAccount(row)
            if (account) accounts.push(account)
        }

        if (accounts.length === 0) {
            throw new AsbImportError(AsbErrorReason.MalformedPayload)
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
