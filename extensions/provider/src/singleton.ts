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

type PersistedKeysResult = {
    keys: Key[]
    /** MMKV entry ids whose records were present but undecodable. */
    failedIds: string[]
    /**
     * The first per-record decrypt/decode failure, kept as the `cause` when a
     * strict caller ({@link hydrateKeystore}) refuses to proceed.
     */
    firstFailure: unknown
}

/**
 * Decrypts every given keystore MMKV entry into its metadata-only {@link Key}.
 * The `privateKey` / `seed` bytes are zeroed before a key is returned. A
 * record that is present but fails to decrypt or decode is skipped rather
 * than aborting the whole pass, but reported in `failedIds` — the wallet key
 * inventory is an integrity boundary, so callers must be able to surface a
 * partial read instead of presenting the survivors as the healthy full set.
 */
const readPersistedKeys = (
    ids: string[],
    masterKey: Buffer,
): PersistedKeysResult => {
    const keys: Key[] = []
    const failedIds: string[] = []
    let firstFailure: unknown

    for (const id of ids) {
        const encrypted = keystoreStorage.getString(id)
        if (!encrypted) continue

        try {
            const decrypted = decryptData(masterKey, encrypted)
            const data = decode(decrypted) as KeyData & { seed?: Uint8Array }
            if (data.privateKey instanceof Uint8Array) data.privateKey.fill(0)
            if (data.seed instanceof Uint8Array) data.seed.fill(0)
            const { privateKey: _pk, seed: _seed, ...meta } = data
            keys.push(meta as Key)
        } catch (err) {
            failedIds.push(id)
            firstFailure ??= err
        }
    }

    return { keys, failedIds, firstFailure }
}

/**
 * Hydration refused to seed the store because specific persisted records
 * would not decrypt/decode. Distinguished from other bootstrap failures so
 * the app can show a data-integrity message (and support gets record ids)
 * instead of a generic "try again" that can never succeed.
 */
export class KeystoreHydrationError extends Error {
    readonly failedIds: string[]
    readonly cause: unknown

    constructor(failedIds: string[], cause: unknown) {
        super(
            `keystore hydration failed: undecodable key record(s): ${failedIds.join(', ')}`,
        )
        this.name = 'KeystoreHydrationError'
        this.failedIds = failedIds
        this.cause = cause
    }
}

/**
 * Reads every entry out of the keystore's MMKV namespace, decrypts metadata,
 * and seeds the reactive store with the result. Must be called once during
 * app bootstrap — the underlying `react-native-keystore` package only mutates
 * `state.keys` on `commit` / `removeKey`, so without this step persisted
 * entries from previous sessions are invisible to the synchronous lookups
 * (`hasSecret`, `useKMS.getKey`, etc.) until a session-local mutation
 * happens to add them.
 *
 * The reactive store holds metadata only — `privateKey` and `seed` bytes are
 * decrypted briefly to read the rest of the record, then zeroed before any
 * Key is pushed into `state.keys`. The master key copy is fetched once and
 * zeroed in `finally`.
 *
 * Idempotent: skips if the reactive store is already populated. Safe to call
 * even if the keystore is empty (no master key generated yet).
 *
 * Strict: throws {@link KeystoreHydrationError} when any persisted record is
 * present but undecodable, instead of hydrating the survivors as if they were
 * the full set. A partial hydration would leave accounts visible without
 * usable signing keys — and a wallet that looks emptier than the disk is what
 * prompts users to wipe and re-onboard on top of keys still in storage.
 */
export const hydrateKeystore = async (): Promise<void> => {
    if (keystoreStore.state.keys.length > 0) return

    const ids = keystoreStorage.getAllKeys()
    if (ids.length === 0) return

    let masterKey: Buffer | null = null
    try {
        masterKey = await readMasterKey()
        const { keys, failedIds, firstFailure } = readPersistedKeys(
            ids,
            masterKey,
        )
        if (failedIds.length > 0) {
            throw new KeystoreHydrationError(failedIds, firstFailure)
        }
        initializeKeyStore({ store: keystoreStore, keys })
    } finally {
        if (masterKey) masterKey.fill(0)
    }
}

export type KeystoreReconcileResult = {
    /** MMKV entry ids whose records were present but undecodable. */
    failedIds: string[]
}

/**
 * Re-seeds the reactive store from the keystore MMKV namespace so the in-process
 * store reflects writes made by an out-of-process writer. The Android passkey
 * credential provider runs in a separate process and writes straight to the
 * keystore MMKV namespace — both newly-registered `hd-derived-p256` keys AND
 * metadata updates on existing keys (e.g. bumping `lastUsedAt`/`count` when a
 * credential is used). The in-process reactive store learns about neither until
 * the next cold-start `hydrateKeystore`.
 *
 * Unlike {@link hydrateKeystore} this does NOT skip when the store is already
 * populated: it re-reads every entry and re-initializes the store. Re-reading
 * (rather than merging only the ids not yet present) is what surfaces metadata
 * updates on keys that are already in the store — merging new ids alone would
 * miss them. Skips fetching the master key only when MMKV is empty.
 *
 * Unlike {@link hydrateKeystore} it is also tolerant: an undecodable record is
 * skipped so an out-of-process write can never take a running session down,
 * but the skipped ids are returned — the strict hydration will refuse those
 * same records at the next cold start, so callers must report them while the
 * app is still up.
 */
export const reconcileKeystore = async (): Promise<KeystoreReconcileResult> => {
    const ids = keystoreStorage.getAllKeys()

    // Deliberately stale-over-empty: MMKV is multi-process, and replacing the
    // reactive keys with [] here would render an empty wallet on a transient
    // or spurious empty read — which is what prompts users to wipe and
    // re-onboard on top of keys still on disk. In-process deletion flows
    // update the store through the keystore package, so they never rely on
    // this pass.
    if (ids.length === 0) return { failedIds: [] }

    let masterKey: Buffer | null = null
    try {
        masterKey = await readMasterKey()
        const { keys, failedIds } = readPersistedKeys(ids, masterKey)
        initializeKeyStore({ store: keystoreStore, keys })
        return { failedIds }
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
