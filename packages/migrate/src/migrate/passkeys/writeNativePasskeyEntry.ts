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

import { Platform } from 'react-native'
import {
    encode,
    encryptData,
    getMasterKey,
    storage,
} from '@algorandfoundation/react-native-keystore'

export const nativePasskeyEntryExists = (credentialId: string): boolean =>
    storage.getString(credentialId) != null

export type WriteNativePasskeyEntryParams = {
    /** Standard-base64 SHA-256(SPKI DER) — also the MMKV key. */
    credentialId: string
    /** WebAuthn relying-party origin (e.g. `webauthn.io`). */
    origin: string
    /**
     * WebAuthn `user.id` (base64). Returned to the relying party as the
     * assertion userHandle. See {@link buildKeystoreKeyData} for the
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

const buildKeystoreKeyData = (params: WriteNativePasskeyEntryParams) => ({
    id: params.credentialId,
    type: 'hd-derived-p256',
    algorithm: 'P256',
    extractable: false,
    keyUsages: ['sign'],
    name: `Passkey: ${params.origin}`,
    privateKey: params.privateKey,
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

const commitEncryptedKeystoreEntry = async (
    credentialId: string,
    keyData: ReturnType<typeof buildKeystoreKeyData>,
): Promise<void> => {
    const masterKey = await getMasterKey()
    storage.set(
        credentialId,
        encryptData(masterKey, encode(keyData as Parameters<typeof encode>[0])),
    )
}

/**
 * Persists a credential into the native autofill module's own encrypted MMKV
 * envelope — the module has no JS create-bridge, but its `CredentialRepository`
 * reads the same envelope back under the credentialId key. We bypass the
 * keystore's `importKey`/`generate` helpers: both force a random key id and
 * re-derive a different keypair instead of persisting the one we supply.
 */
export const writeNativePasskeyEntry = (
    params: WriteNativePasskeyEntryParams,
): Promise<void> =>
    commitEncryptedKeystoreEntry(
        params.credentialId,
        buildKeystoreKeyData(params),
    )
