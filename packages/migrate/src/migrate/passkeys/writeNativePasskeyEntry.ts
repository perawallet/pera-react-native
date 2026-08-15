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

import { Platform } from 'react-native'
import { subtle as quickCryptoSubtle } from 'react-native-quick-crypto'
import {
    MATERIAL_PREFIX,
    METADATA_PREFIX,
    readMasterKey,
    sealData,
    serializeKey,
    storage,
} from '@algorandfoundation/react-native-keystore'
import type { Key } from '@algorandfoundation/react-native-keystore'
import { zeroBytes } from '@perawallet/wallet-core-kms'

export const nativePasskeyEntryExists = (credentialId: string): boolean =>
    storage.getString(METADATA_PREFIX + credentialId) != null

// Standard base64, matching `@scure/base`'s `base64.encode` (what
// `sealData`'s callers elsewhere in the keystore use) — restated so this
// package doesn't need a direct dependency on `@scure/base` for one call.
const toStandardBase64 = (bytes: Uint8Array): string =>
    btoa(String.fromCharCode(...bytes))

export type WriteNativePasskeyEntryParams = {
    /** Standard-base64 SHA-256(SPKI DER) — also the MMKV key. */
    credentialId: string
    /** WebAuthn relying-party origin (e.g. `webauthn.io`). */
    origin: string
    /**
     * WebAuthn `user.id` (base64). Returned to the relying party as the
     * assertion userHandle. See {@link buildKeyMetadata} for the
     * platform-specific metadata mapping.
     */
    userId: string
    /**
     * WebAuthn `user.name`. The display title; never returned to the RP.
     */
    userName?: string
    /**
     * WebAuthn `user.displayName`. Surfaced as `metadata.displayName` — the
     * preferred display title when present. Display-only.
     */
    displayName?: string
    /** 91-byte X.509/SPKI DER public key. */
    publicKeySpkiDer: Uint8Array
    /** Raw 32-byte P-256 private scalar. */
    privateKey: Uint8Array
    /** Signature counter; legacy passkeys carry no counter, so defaults to 0. */
    count?: number
    /** Optional last-used timestamp, preserved in metadata for parity. */
    lastUsedAtMs?: number | null
}

/**
 * The plaintext `k/<id>` record. Private-key bytes never appear here — they
 * are sealed separately at `m/<id>`.
 *
 * `name` isn't part of the generic `Key` shape, but it matches what the
 * provider's own `CredentialRepository.saveCredential` writes for a
 * natively-created credential (`"Passkey: ${origin}"`) — kept for parity even
 * though nothing currently reads it back.
 */
type NativePasskeyKeyMetadata = Key & { name: string }

const buildKeyMetadata = (
    params: WriteNativePasskeyEntryParams,
): NativePasskeyKeyMetadata => ({
    id: params.credentialId,
    type: 'hd-derived-p256',
    algorithm: 'P256',
    extractable: false,
    keyUsages: ['sign'],
    name: `Passkey: ${params.origin}`,
    publicKey: params.publicKeySpkiDer,
    metadata: {
        origin: params.origin,
        // userHandle is platform-overloaded: Android's picker renders it as the
        // label (assertion reads userId) so it must be user.name; iOS uses it as
        // the assertion id (display reads userName).
        userHandle:
            Platform.OS === 'android'
                ? (params.userName ?? params.userId)
                : params.userId,
        userId: params.userId,
        ...(params.userName != null ? { userName: params.userName } : {}),
        ...(params.displayName != null
            ? { displayName: params.displayName }
            : {}),
        count: params.count ?? 0,
        ...(params.lastUsedAtMs != null
            ? { lastUsedAt: params.lastUsedAtMs }
            : {}),
    },
})

export type NativePasskeyWriter = ((
    params: WriteNativePasskeyEntryParams,
) => Promise<void>) & {
    /** Zeroes the cached master key (reused across the batch); await after the last write. */
    dispose: () => Promise<void>
}

/**
 * Creates a writer that fetches and decrypts the keystore master key once and
 * reuses it for every passkey written through the returned function. Migration
 * runs on the splash screen while the user waits, so collapsing the per-passkey
 * secure-storage round-trips into a single fetch keeps that wait short when a
 * user has many passkeys.
 *
 * Persists each credential directly into the keystore's own `k/`+`m/` layout —
 * the split the credential provider's `CredentialRepository` reads natively as
 * of autofill canary.23/.24. We bypass the keystore's `importKey`/`generate`
 * helpers: both force a random key id and re-derive a different keypair
 * instead of persisting the one we supply.
 *
 * Writing the split layout directly, rather than a flat bare-id record for
 * upstream's `adopt-flat-records` revision to pick up, matters because this
 * migration runs at a different time than provider startup: a flat record
 * written after that revision has already run (and been recorded in the
 * migrations ledger) would never be adopted, leaving the credential invisible.
 *
 * A failed fetch isn't cached, so a later write retries rather than inheriting a
 * poisoned key.
 */
export const createNativePasskeyWriter = (
    subtle: SubtleCrypto = quickCryptoSubtle as unknown as SubtleCrypto,
): NativePasskeyWriter => {
    let masterKeyPromise: ReturnType<typeof readMasterKey> | undefined

    const resolveMasterKey = (): ReturnType<typeof readMasterKey> => {
        if (!masterKeyPromise) {
            masterKeyPromise = readMasterKey().catch(err => {
                masterKeyPromise = undefined
                throw err
            })
        }
        return masterKeyPromise
    }

    const write: NativePasskeyWriter = async params => {
        const masterKey = await resolveMasterKey()
        storage.set(
            METADATA_PREFIX + params.credentialId,
            serializeKey(buildKeyMetadata(params)),
        )
        storage.set(
            MATERIAL_PREFIX + params.credentialId,
            await sealData(
                subtle,
                masterKey,
                toStandardBase64(params.privateKey),
            ),
        )
    }

    write.dispose = (): Promise<void> => {
        const pending = masterKeyPromise
        masterKeyPromise = undefined
        return pending ? pending.then(zeroBytes, () => {}) : Promise.resolve()
    }

    return write
}

/**
 * One-off write that fetches the master key for this single entry. Prefer
 * {@link createNativePasskeyWriter} when writing many entries in a batch.
 */
export const writeNativePasskeyEntry = async (
    params: WriteNativePasskeyEntryParams,
    subtle?: SubtleCrypto,
): Promise<void> => {
    const write = createNativePasskeyWriter(subtle)
    try {
        await write(params)
    } finally {
        await write.dispose()
    }
}
