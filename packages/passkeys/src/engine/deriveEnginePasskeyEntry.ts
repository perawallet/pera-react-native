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

import type { Key } from '@algorandfoundation/keystore-core'
import { entropyChildIdOf } from '@perawallet/wallet-core-kms'
import { bytesEqual, toUrlSafeBase64 } from '@perawallet/wallet-core-shared'
import {
    getKeystore,
    getKeystoreStore,
    getProvider,
    PASSKEY_MAIN_KEY_SCHEME,
} from '@perawallet/wallet-extension-provider'
import { isPasskeyKey } from '../models/passkey'
import {
    passkeyMainKeyIdFromSeedKeyId,
    passkeyPublicKeyToSpkiDer,
} from '../models/passkeyBackup'

/*
 * The browser extension's keystore engine holds no passkey material: it
 * re-derives each credential from its seed's `pbkdf2-p256` main key at sign
 * time, and its `import` rejects a raw P-256 key. So a credential restored
 * there is re-derived under the restored seed instead of written, and kept
 * only if it reproduces the backed-up public key.
 */

/** True only in the browser extension, the one platform whose passkeys live
 *  in the engine rather than with a native credential provider. */
export const storesPasskeysInEngine = (): boolean =>
    getProvider().deviceInfo.getDevicePlatform() === 'web'

export type DeriveEnginePasskeyEntryParams = {
    /** Kept as the key id, so the next backup sweep files the credential
     *  under the item it was restored from instead of adding a second one. */
    credentialId: string
    origin: string
    /** The derivation string the backup proved, replayed verbatim. */
    identity: string
    /** The derivation counter, NOT the WebAuthn signature counter. */
    counter: number
    seedKeyId: string
    /** 91-byte SPKI DER the derived key has to reproduce. */
    publicKeySpkiDer: Uint8Array
    /** WebAuthn `user.id`, base64 in either alphabet. */
    userId?: string
    userName?: string
    displayName?: string
    /** Unix ms. */
    createdAtMs?: number
}

export type EnginePasskeyWriteResult = 'written' | 'pubkey-mismatch'

const hasPublicKey = (key: Key, spkiDer: Uint8Array): boolean => {
    if (!key.publicKey) return false
    try {
        return bytesEqual(passkeyPublicKeyToSpkiDer(key.publicKey), spkiDer)
    } catch {
        return false
    }
}

/** Also true for the same credential under another id: re-registering with
 *  the same seed, origin and user derives the same key. */
export const enginePasskeyEntryExists = (
    credentialId: string,
    publicKeySpkiDer: Uint8Array,
): boolean =>
    getKeystoreStore().state.keys.some(
        key =>
            key.id === credentialId ||
            (isPasskeyKey(key) && hasPublicKey(key, publicKeySpkiDer)),
    )

/** Matched on its parent rather than taken as the device's one main key: a
 *  credential only re-derives under the seed that minted it. */
const ensureSeedMainKey = async (seedKeyId: string): Promise<string> => {
    const keys = getKeystoreStore().state.keys
    const entropyChildId = entropyChildIdOf(seedKeyId, keys)
    if (!entropyChildId) {
        throw new Error(
            `Seed ${seedKeyId} has no entropy child to derive passkeys from`,
        )
    }

    const existing = keys.find(
        key =>
            key.type === 'hd-root-key' &&
            key.metadata?.scheme === PASSKEY_MAIN_KEY_SCHEME &&
            key.metadata?.parentKeyId === entropyChildId,
    )
    if (existing) return existing.id

    return getKeystore().generate({
        // `algorithm: 'P256'` routes this to the PBKDF2 main key rather than
        // the XHD root; both are `hd-root-key`.
        type: 'hd-root-key',
        algorithm: 'P256',
        extractable: false,
        keyUsages: ['deriveBits', 'deriveKey'],
        params: {
            parentKeyId: entropyChildId,
            id: passkeyMainKeyIdFromSeedKeyId(seedKeyId),
        },
    })
}

export const deriveEnginePasskeyEntry = async (
    params: DeriveEnginePasskeyEntryParams,
): Promise<EnginePasskeyWriteResult> => {
    const keystore = getKeystore()
    if (!keystore.deriveDomainKey) {
        throw new Error('This keystore cannot derive passkeys')
    }

    const mainKeyId = await ensureSeedMainKey(params.seedKeyId)
    const keyId = await keystore.deriveDomainKey(mainKeyId, {
        algorithm: 'P256',
        origin: params.origin,
        userHandle: params.identity,
        counter: params.counter,
        id: params.credentialId,
        metadata: {
            // Read back first by `identityCandidates`, so the next sweep proves
            // the credential with the string that proved it here.
            identity: params.identity,
            ...(params.userId != null
                ? {
                      // What the extension answers an assertion's `userHandle`
                      // with; without it the RP gets the lossy derivation input.
                      userHandleOriginal: toUrlSafeBase64(params.userId),
                      // As the backup carried it, so a sweep here hashes the
                      // credential the same as the item it was restored from.
                      userId: params.userId,
                  }
                : {}),
            ...(params.userName != null ? { userName: params.userName } : {}),
            ...(params.displayName != null
                ? { displayName: params.displayName }
                : {}),
            ...(params.createdAtMs ? { createdAt: params.createdAtMs } : {}),
        },
    })

    const written = getKeystoreStore().state.keys.find(key => key.id === keyId)
    if (written && hasPublicKey(written, params.publicKeySpkiDer)) {
        return 'written'
    }
    await keystore.remove(keyId)
    return 'pubkey-mismatch'
}
