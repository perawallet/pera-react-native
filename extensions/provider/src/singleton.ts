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

import { Store } from '@tanstack/store'
import Hook from 'before-after-hook'
import type { HookCollection } from 'before-after-hook'
import type { Key, KeyStoreState } from '@algorandfoundation/keystore-core'
import type { ReactNativeKeyStore } from '@algorandfoundation/react-native-keystore'
import {
    decode,
    storage as keystoreStorage,
} from '@algorandfoundation/react-native-keystore'
import { createPeraKeystore } from './keystore/createKeystore'
import { PeraProvider } from './pera-provider'

/** The driver's metadata bucket. Sealed material lives under `m/` instead. */
const METADATA_PREFIX = 'k/'

const keystoreStore = new Store<KeyStoreState>({
    keys: [],
    status: 'idle',
})
const keystoreHooks = new Hook.Collection()

const keystore = createPeraKeystore({
    store: keystoreStore,
    hooks: keystoreHooks,
})

let instance: PeraProvider | null = new PeraProvider(
    {
        id: 'pera-wallet',
        name: 'Pera Wallet',
    },
    {
        api: { keystore },
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
 * The same instance the {@link KeyStoreExtension} holds, so it reflects every
 * keystore mutation. Subscribe via `useSyncExternalStore`.
 */
export const getKeystoreStore = (): Store<KeyStoreState> => keystoreStore

/**
 * The keystore the provider was built with. Await its `ready` during bootstrap:
 * it resolves once the shim stack is layered and persisted metadata has been
 * loaded into {@link getKeystoreStore}.
 */
export const getKeystore = (): ReactNativeKeyStore => keystore

/**
 * Where wallet-domain packages register hooks to intercept keystore operations.
 * `wrap` fully replaces one — kms uses it to route `type: 'algo25'` signing
 * through tweetnacl.
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
    await keystore.clear?.()
}

/**
 * `null` on a missing or unreadable entry, so a caller can skip it rather than
 * abort a whole reconcile pass.
 */
const decodeKeyEntry = (key: string): Key | null => {
    const raw = keystoreStorage.getString(key)
    if (!raw) return null

    try {
        return decode(raw) as Key
    } catch (err) {
        console.error(
            `[provider] keystore decode: failed to decode entry ${key}`,
            err,
        )
        return null
    }
}

/**
 * Re-seeds the store to pick up out-of-process writes. The Android passkey
 * credential provider runs in its own process and writes straight to the MMKV
 * namespace — both new keys and metadata updates on existing ones — and nothing
 * in the engine re-reads: its `ready` hydration runs once per launch.
 *
 * Re-reading every entry (rather than merging only the ids not yet present) is
 * what surfaces metadata updates on keys already in the store.
 *
 * No master key and no biometric prompt: the driver keeps metadata in the `k/`
 * bucket as plaintext and only material under `m/` is sealed.
 */
export const reconcileKeystore = async (): Promise<void> => {
    const keys = keystoreStorage
        .getAllKeys()
        .filter(key => key.startsWith(METADATA_PREFIX))
        .map(decodeKeyEntry)
        .filter((key): key is Key => key !== null)

    if (keys.length === 0) return

    keystoreStore.setState(state => ({ ...state, keys }))
}

/**
 * Resets the provider singleton. Only for use in tests.
 */
export const resetProvider = (): void => {
    instance = null
}
