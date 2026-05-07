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

import type { KeyData } from '@algorandfoundation/keystore'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'

/**
 * Sensitive byte material persisted in the platform keystore (encrypted at
 * rest via the keystore's MMKV+AES-GCM). The keystore's `KeyType` is a free
 * string union, so any value here is opaque to it; the `type` lets us
 * namespace secrets (e.g. `'algo25'`, `'pera.pin-record'`) when iterating
 * the reactive store.
 */
export type TypedSecret = {
    id: string
    type: string
    bytes: Uint8Array
    algorithm?: string
    keyUsages?: KeyUsage[]
    publicKey?: Uint8Array
    metadata?: Record<string, unknown>
}

/**
 * Upserts a typed secret into the keystore.
 *
 * Lazy imports `@algorandfoundation/react-native-keystore` so this module
 * stays importable in vitest environments that lack `react-native-mmkv`.
 */
export const commitTypedSecret = async ({
    id,
    type,
    bytes,
    algorithm = 'raw',
    keyUsages = [],
    publicKey,
    metadata,
}: TypedSecret): Promise<void> => {
    const { commit } = await import('@algorandfoundation/react-native-keystore')

    const store = getKeystoreStore()

    // we commit the new key first then remove the old one to ensure that the key is always present in the store (either the old or the new)
    // and avoid edge cases where the key could be missing if the commit succeeds but the remove fails
    await commit({
        store,
        keyData: {
            id,
            type,
            algorithm,
            format: 'raw',
            extractable: true,
            keyUsages,
            ...(publicKey !== undefined ? { publicKey } : {}),
            privateKey: new Uint8Array(bytes),
            ...(metadata !== undefined ? { metadata } : {}),
        } as unknown as KeyData,
    })

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
 * Synchronous existence check via the reactive store. Usable from React
 * render guards because the provider's `hydrateKeystore` populates the
 * store from MMKV during bootstrap.
 */
export const hasTypedSecret = (id: string): boolean => {
    return getKeystoreStore().state.keys.some(k => k.id === id)
}

/**
 * Runs `handler` with the decrypted bytes for `id`, then zeroes them in
 * `finally`. The secret never leaves this scope as a returned value, which
 * keeps sensitive material out of the caller's hands beyond the handler's
 * lifetime. Returns `null` (without invoking `handler`) when the secret
 * doesn't exist. Mirrors `withExportedKey` from `useKMSService` for the
 * typed-secret case.
 */
export const withTypedSecret = async <T>(
    id: string,
    handler: (bytes: Uint8Array) => T | Promise<T>,
): Promise<T | null> => {
    if (!hasTypedSecret(id)) return null
    const data = await getProvider().key.store.export(id)
    const bytes = data.privateKey
    if (!bytes) return null
    try {
        return await handler(bytes)
    } finally {
        bytes.fill(0)
    }
}

/**
 * Removes a secret if present. No-op (no throw) when the id isn't there, so
 * callers can use this freely as a "delete-if-exists" without catching.
 */
export const removeTypedSecret = async (id: string): Promise<void> => {
    if (!hasTypedSecret(id)) return
    const { removeKey } =
        await import('@algorandfoundation/react-native-keystore')
    try {
        await removeKey({ store: getKeystoreStore(), keyId: id })
    } catch {
        // Tolerate not-found races between the hasTypedSecret check and the
        // removeKey call (or any other source of `KeyNotFoundError`).
    }
}
