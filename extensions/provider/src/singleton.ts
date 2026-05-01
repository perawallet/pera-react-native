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
import type { KeyStoreState } from '@algorandfoundation/keystore'
import { clear as clearKeystoreStore } from '@algorandfoundation/react-native-keystore'
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
 * Resets the provider singleton. Only for use in tests.
 */
export const resetProvider = (): void => {
    instance = null
}
