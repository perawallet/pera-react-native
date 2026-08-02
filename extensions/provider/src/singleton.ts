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
import type { Key, KeyData, KeyStoreState } from '@algorandfoundation/keystore'
import { initializeKeyStore } from '@algorandfoundation/keystore'
import {
    clear as clearKeystoreStore,
    decode,
    decryptData,
    readMasterKey,
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
 * The same instance the {@link KeyStoreExtension} holds, so it reflects every
 * keystore mutation. Subscribe via `useSyncExternalStore`.
 */
export const getKeystoreStore = (): Store<KeyStoreState> => keystoreStore

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
    await clearKeystoreStore({ store: keystoreStore })
}

/**
 * Metadata only — the `privateKey`/`seed` bytes are zeroed before returning.
 * `null` on a missing or undecodable entry, so a caller can skip it rather than
 * abort a whole hydration pass.
 */
const decodeKeyEntry = (id: string, masterKey: Buffer): Key | null => {
    const encrypted = keystoreStorage.getString(id)
    if (!encrypted) return null

    try {
        const decrypted = decryptData(masterKey, encrypted)
        const data = decode(decrypted) as KeyData & { seed?: Uint8Array }
        if (data.privateKey instanceof Uint8Array) data.privateKey.fill(0)
        if (data.seed instanceof Uint8Array) data.seed.fill(0)
        const { privateKey: _pk, seed: _seed, ...meta } = data
        return meta as Key
    } catch (err) {
        console.error(
            `[provider] keystore decode: failed to decode entry ${id}`,
            err,
        )
        return null
    }
}

/**
 * Seeds the reactive store from the keystore MMKV namespace. Must run once at
 * bootstrap: `react-native-keystore` only mutates `state.keys` on
 * `commit`/`removeKey`, so without this, entries persisted in earlier sessions
 * are invisible to the synchronous lookups until a session-local mutation
 * happens to add them.
 *
 * Metadata only — secret bytes are decrypted briefly to read the rest of the
 * record, then zeroed. Idempotent, safe on an empty keystore, and entries that
 * fail to decrypt are logged and skipped rather than aborting.
 */
export const hydrateKeystore = async (): Promise<void> => {
    if (keystoreStore.state.keys.length > 0) return

    const ids = keystoreStorage.getAllKeys()
    if (ids.length === 0) return

    let masterKey: Buffer | null = null
    try {
        masterKey = await readMasterKey()
        const mk = masterKey
        const keys = ids
            .map(id => decodeKeyEntry(id, mk))
            .filter((key): key is Key => key !== null)
        initializeKeyStore({ store: keystoreStore, keys })
    } finally {
        if (masterKey) masterKey.fill(0)
    }
}

/**
 * Re-seeds the store to pick up out-of-process writes. The Android passkey
 * credential provider runs in its own process and writes straight to the MMKV
 * namespace — both new keys and metadata updates on existing ones — none of
 * which the in-process store sees until the next cold-start hydrate.
 *
 * Unlike {@link hydrateKeystore} this does NOT skip when the store is already
 * populated: it re-reads every entry and re-initializes the store. Re-reading
 * (rather than merging only the ids not yet present) is what surfaces metadata
 * updates on keys that are already in the store — merging new ids alone would
 * miss them. Skips fetching the master key only when MMKV is empty.
 */
export const reconcileKeystore = async (): Promise<void> => {
    const ids = keystoreStorage.getAllKeys()
    if (ids.length === 0) return

    let masterKey: Buffer | null = null
    try {
        masterKey = await readMasterKey()
        const mk = masterKey
        const keys = ids
            .map(id => decodeKeyEntry(id, mk))
            .filter((key): key is Key => key !== null)
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
