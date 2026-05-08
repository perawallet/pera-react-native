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

import { Store } from '@tanstack/store'
import Hook from 'before-after-hook'
import type { HookCollection } from 'before-after-hook'
import type { Key, KeyData, KeyStoreState } from '@algorandfoundation/keystore'
import { initializeKeyStore } from '@algorandfoundation/keystore'
import {
    clear as clearKeystoreStore,
    decode,
    decryptData,
    getMasterKey,
    storage as keystoreStorage,
} from '@algorandfoundation/react-native-keystore'
import { PeraProvider } from './pera-provider'

const keystoreStore = new Store<KeyStoreState>({
    keys: [],
    status: 'idle',
})
const keystoreHooks = new Hook.Collection()

let instance: PeraProvider | null = new PeraProvider(
    {
        id: 'pera-wallet',
        name: 'Pera Wallet',
    },
    {
        keystore: {
            store: keystoreStore,
            hooks: keystoreHooks,
        },
    },
)

/**
 * Returns the provider singleton. Throws if called before `initializeProvider()`.
 * Use the generic parameter to cast to a provider type with extensions applied.
 */
export const getProvider = (): PeraProvider => {
    if (!instance) {
        throw new Error(
            'Provider not initialized. Call initializeProvider() during bootstrap.',
        )
    }
    return instance
}

/**
 * Returns the keystore's reactive TanStack Store. The same instance is held by
 * the {@link KeyStoreExtension}, so it reflects every keystore mutation
 * (`import` / `generate` / `remove` / `clear`). Subscribe via `useSyncExternalStore`.
 */
export const getKeystoreStore = (): Store<KeyStoreState> => keystoreStore

/**
 * Returns the keystore's hook collection (`before-after-hook`). Wallet-domain
 * packages register `before` / `after` / `wrap` / `error` hooks here to
 * intercept keystore operations such as `sign`, `generate`, `remove`, etc.
 *
 * `wrap` lets a registrant fully replace an operation — used by the kms
 * package to route signing for our custom `type: 'algo25'` keys through
 * tweetnacl.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getKeystoreHooks = (): HookCollection<any> => keystoreHooks

/**
 * Sets the provider singleton. Must be called exactly once during app bootstrap.
 */
export const initializeProvider = (provider: PeraProvider): void => {
    if (instance) {
        throw new Error('Provider already initialized.')
    }
    instance = provider
}

/**
 * Clears all keys from the keystore's persistent storage and reactive store.
 * Used during "delete all data" flows as a safety net after individual key deletion.
 */
export const clearKeystore = async (): Promise<void> => {
    await clearKeystoreStore({ store: keystoreStore })
}

/**
 * Reads every entry out of the keystore's MMKV namespace, decrypts metadata,
 * and seeds the reactive store with the result. Must be called once during
 * app bootstrap — the underlying `react-native-keystore` package only mutates
 * `state.keys` on `commit` / `removeKey`, so without this step persisted
 * entries from previous sessions are invisible to the synchronous lookups
 * (`hasTypedSecret`, `useKMS.getKey`, etc.) until a session-local mutation
 * happens to add them.
 *
 * The reactive store holds metadata only — `privateKey` and `seed` bytes are
 * decrypted briefly to read the rest of the record, then zeroed before any
 * Key is pushed into `state.keys`. The master key copy is fetched once and
 * zeroed in `finally`.
 *
 * Idempotent: skips if the reactive store is already populated. Safe to call
 * even if the keystore is empty (no master key generated yet) — entries that
 * fail to decrypt are logged and skipped rather than aborting hydration.
 */
export const hydrateKeystore = async (): Promise<void> => {
    if (keystoreStore.state.keys.length > 0) return

    const ids = keystoreStorage.getAllKeys()
    if (ids.length === 0) return

    let masterKey: Buffer | null = null
    try {
        masterKey = await getMasterKey()
        const keys: Key[] = []

        for (const id of ids) {
            const encrypted = keystoreStorage.getString(id)
            if (!encrypted) continue

            try {
                const decrypted = decryptData(masterKey, encrypted)
                const data = decode(decrypted) as KeyData & {
                    seed?: Uint8Array
                }
                if (data.privateKey instanceof Uint8Array) {
                    data.privateKey.fill(0)
                }
                if (data.seed instanceof Uint8Array) {
                    data.seed.fill(0)
                }
                const { privateKey: _pk, seed: _seed, ...meta } = data
                keys.push(meta as Key)
            } catch (err) {
                console.error(
                    `[provider] keystore hydration: failed to decode entry ${id}`,
                    err,
                )
            }
        }

        initializeKeyStore({ store: keystoreStore, keys })
    } finally {
        if (masterKey) masterKey.fill(0)
    }
}

/**
 * Resets the provider singleton. Only for use in tests.
 */
export const resetProvider = (): void => {
    instance = null
}
