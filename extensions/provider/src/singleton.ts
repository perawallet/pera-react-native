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
import type { KeyStoreState } from '@algorandfoundation/keystore-core'
import type { ReactNativeKeyStore } from '@algorandfoundation/react-native-keystore'
import type { MigrationReport } from '@algorandfoundation/provider-migrations'
import { createPeraKeystore } from './keystore/createKeystore'
import { readPersistedKeys, runMaterialRepair } from './keystore/maintenance'
import type { QuantumMaterialRepairResult } from './keystore/repairQuantumMaterial'
import { createPeraMigrationLedger } from './keystore/migrationsLedger'
import { PeraProvider } from './pera-provider'

const keystoreStore = new Store<KeyStoreState>({
    keys: [],
    status: 'idle',
})
const keystoreHooks = new Hook.Collection()

// The keystore needs `provider.migrations.ready` to gate its hydration, but
// the provider needs a concrete keystore to construct (it's injected through
// `options.api.keystore`). A deferred promise breaks the cycle: the keystore
// is built against it first, and it's wired to the real
// `provider.migrations.ready` once the provider exists. `WithMigrations`
// runs its first pass on a microtask, which can't fire until this
// synchronous module body — including the `.then` below — has finished, so
// nothing races.
let resolveMigrations!: (report: MigrationReport) => void
let rejectMigrations!: (error: unknown) => void
const migrationsReady = new Promise<MigrationReport>((resolve, reject) => {
    resolveMigrations = resolve
    rejectMigrations = reject
})

const keystore = createPeraKeystore({
    store: keystoreStore,
    hooks: keystoreHooks,
    before: migrationsReady,
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
        migrations: { ledger: createPeraMigrationLedger() },
    },
)

instance.migrations.ready.then(resolveMigrations, rejectMigrations)

/**
 * Resolves once the startup migration run settles, mirroring
 * `provider.migrations.ready`. Exists as a module-level export because the
 * keystore is built (and gated on this) before the provider — the one that
 * owns `migrations` — exists.
 */
export const getMigrationsReady = (): Promise<MigrationReport> =>
    migrationsReady

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
    const keys = readPersistedKeys()

    if (keys.length === 0) return

    keystoreStore.setState(state => ({ ...state, keys }))
}

/**
 * Re-mints Falcon children that never had sealed material. Must run after the
 * engine has hydrated, since it works off the reactive key snapshot.
 */
export const runQuantumMaterialRepair =
    (): Promise<QuantumMaterialRepairResult> =>
        runMaterialRepair({
            keys: () => keystoreStore.state.keys,
            regenerate: async (childId, parentKeyId) => {
                // `parentKeyId` (not the seed itself): the engine resolves the
                // parent through the driver, so the seed never reaches JS.
                await keystore.generate({
                    type: 'falcon-1024',
                    algorithm: 'Falcon-1024',
                    extractable: false,
                    keyUsages: ['sign', 'verify'],
                    params: { parentKeyId, id: childId },
                })
            },
        })

export type KeystoreMaintenanceResult = {
    repair: QuantumMaterialRepairResult
}

/**
 * Every one-off pass the on-disk keystore needs at startup, in the one order
 * that works. Callers await this instead of sequencing the passes themselves.
 *
 * `ready` now already sits behind `provider.migrations.ready` (see
 * `getMigrationsReady` above), so any layout re-indexing has happened before
 * this ever runs — this no longer sequences a migration itself.
 *
 * The ordering that remains is not incidental:
 *
 * - `reconcileKeystore` runs first to pick up anything the Android passkey
 *   credential provider wrote from its own process while this process was not
 *   yet reading — `ready`'s hydration runs once per launch and nothing else
 *   re-reads.
 * - The quantum repair runs on **every** launch: a quantum account minted
 *   before custody moved into the keystore has a child with no sealed
 *   material, and that fails only at submit time, after the user has already
 *   signed. It is not a tracked migration revision for exactly that reason —
 *   it has no "done" state to record, it must keep checking every launch.
 * - A second `reconcileKeystore` runs only when the repair actually did
 *   something, since it re-reads every entry and paying that cost on a launch
 *   where nothing changed is pure cost.
 *
 * Throws if the keystore cannot hydrate. That is deliberate — the alternative
 * is presenting an empty wallet, which is what prompts users to wipe and
 * re-onboard on top of keys that are still on disk.
 *
 * On web this is inert: `maintenance.web.ts` returns a zeroed repair result,
 * so nothing reconciles and callers need no platform branch.
 */
export const runKeystoreMaintenance =
    async (): Promise<KeystoreMaintenanceResult> => {
        await keystore.ready

        await reconcileKeystore()

        const repair = await runQuantumMaterialRepair()
        if (repair.repaired > 0 || repair.failed > 0) {
            await reconcileKeystore()
        }

        return { repair }
    }

/**
 * Resets the provider singleton. Only for use in tests.
 */
export const resetProvider = (): void => {
    instance = null
}
