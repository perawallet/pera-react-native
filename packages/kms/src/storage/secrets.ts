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

import { type Nullable } from '@perawallet/wallet-core-shared'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import { zeroBytes } from '../crypto/secure-memory'
import { entropyKeyId, hexToBytes } from '../utils'

/**
 * Stores an arbitrary byte payload in the keystore as a canonical
 * `secret-key` entry. Used for PIN records, biometric blobs, and any other
 * Pera-domain secret that doesn't fit the seed/derived-key flow.
 */
export const commitSecret = async (params: {
    id: string
    bytes: Uint8Array
    metadata?: Record<string, unknown>
}): Promise<void> => {
    const keyStore = getProvider().key.store

    const valueCopy = new Uint8Array(params.bytes)
    try {
        await keyStore.generate({
            type: 'secret-key',
            algorithm: 'raw',
            extractable: true,
            keyUsages: [],
            params: {
                id: params.id,
                params: {
                    value: valueCopy,
                    ...(params.metadata !== undefined
                        ? { metadata: params.metadata }
                        : {}),
                },
            },
        })
    } finally {
        zeroBytes(valueCopy)
    }

    const store = getKeystoreStore()
    const seen = new Set<string>()
    const deduped = store.state.keys.filter(k => {
        if (seen.has(k.id)) return false
        seen.add(k.id)
        return true
    })
    if (deduped.length !== store.state.keys.length) {
        store.setState(s => ({ ...s, keys: deduped }))
    }
}

/**
 * Synchronous existence check via the reactive store.
 */
export const hasSecret = (id: string): boolean => {
    return getKeystoreStore().state.keys.some(k => k.id === id)
}

/**
 * Runs `handler` with the decrypted secret bytes for `id`, then zeroes them
 * in `finally`. The secret never leaves this scope as a returned value, so
 * callers can't accidentally retain sensitive material beyond the handler's
 * lifetime. Returns `null` (without invoking `handler`) when the secret
 * doesn't exist. Mirrors the read side of `commitSecret`.
 */
export const withSecret = async <T>(
    id: string,
    handler: (bytes: Uint8Array) => T | Promise<T>,
): Promise<Nullable<T>> => {
    if (!hasSecret(id)) return null
    const data = await getProvider().key.store.export(id)
    const bytes = data.privateKey
    if (!bytes) return null
    try {
        return await handler(bytes)
    } finally {
        zeroBytes(bytes)
    }
}

/**
 * Resolves a bip39 seed's BIP39 entropy and runs `handler` with the bytes,
 * zeroing them in `finally`. Prefers the dedicated `secret-key` child; falls
 * back to the legacy `metadata.entropy` (hex) carried by seeds created before
 * the entropy was split into its own child, so those wallets keep mnemonic
 * recovery and passkey migration. Returns `null` (without invoking `handler`)
 * when neither source has entropy.
 *
 * The legacy value is read in place, not migrated into a child: backfilling
 * would leave the secret in two places, and removing it from the seed metadata
 * needs a seed re-import — which re-exports the XHD root the split exists to
 * stop exporting. A pure read keeps the single existing copy and adds no write.
 */
export const withBip39Entropy = async <T>(
    seedKeyId: string,
    handler: (entropy: Uint8Array) => T | Promise<T>,
): Promise<Nullable<T>> => {
    const childId = entropyKeyId(seedKeyId)
    if (hasSecret(childId)) {
        return withSecret(childId, handler)
    }

    const seedKey = getKeystoreStore().state.keys.find(k => k.id === seedKeyId)
    const legacyHex = (seedKey?.metadata as { entropy?: unknown } | undefined)
        ?.entropy
    if (typeof legacyHex !== 'string' || legacyHex.length === 0) return null

    const entropy = hexToBytes(legacyHex)
    try {
        return await handler(entropy)
    } finally {
        zeroBytes(entropy)
    }
}

/**
 * Removes a secret if present. No-op (no throw) when the id isn't there, so
 * callers can use this freely as a "delete-if-exists" without catching.
 */
export const removeSecret = async (id: string): Promise<void> => {
    if (!hasSecret(id)) return
    try {
        await getProvider().key.store.remove(id)
    } catch {
        // Tolerate not-found races between the hasSecret check and the
        // remove call (or any other source of `KeyNotFoundError`).
    }
}
