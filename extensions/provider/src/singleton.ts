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
import { createPeraKeystore } from './keystore/createKeystore'
import {
    readPersistedKeys,
    runLayoutMigration,
    runMaterialRepair,
} from './keystore/maintenance'
import type { KeystoreLayoutMigrationResult } from './keystore/migrateKeystoreLayout'
import type { QuantumMaterialRepairResult } from './keystore/repairQuantumMaterial'
import { PeraProvider } from './pera-provider'

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

/** Runs the canary.13 → canary.14 storage-layout migration. Native-only. */
export const runKeystoreLayoutMigration =
    (): Promise<KeystoreLayoutMigrationResult> => runLayoutMigration()

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
    migration: KeystoreLayoutMigrationResult
    repair: QuantumMaterialRepairResult
}

/**
 * Every one-off pass the on-disk keystore needs at startup, in the one order
 * that works. Callers await this instead of sequencing the passes themselves.
 *
 * The ordering is not incidental:
 *
 * - `ready` hydrates from the `k/` bucket only, so on the first launch after
 *   the canary.14 upgrade it resolves with **zero keys**. The re-index has to
 *   follow it, never precede it.
 * - `reconcileKeystore` is what re-seeds the store afterwards, and it runs only
 *   when a pass actually did something — it re-reads every entry, so calling it
 *   unconditionally would pay that cost on every launch for nothing.
 * - The quantum repair runs on **every** launch, not just after a migration: a
 *   quantum account minted before custody moved into the keystore has a child
 *   with no sealed material, and that fails only at submit time, after the user
 *   has already signed.
 *
 * Throws if the keystore cannot hydrate. That is deliberate — the alternative
 * is presenting an empty wallet, which is what prompts users to wipe and
 * re-onboard on top of keys that are still on disk.
 *
 * On web this is inert: `maintenance.web.ts` returns zeroed results for both
 * passes, so nothing reconciles and callers need no platform branch.
 */
export const runKeystoreMaintenance =
    async (): Promise<KeystoreMaintenanceResult> => {
        await keystore.ready

        const migration = await runKeystoreLayoutMigration()
        if (migration.migrated > 0 || migration.failed > 0) {
            await reconcileKeystore()
        }

        const repair = await runQuantumMaterialRepair()
        if (repair.repaired > 0 || repair.failed > 0) {
            await reconcileKeystore()
        }

        return { migration, repair }
    }

/**
 * Resets the provider singleton. Only for use in tests.
 */
export const resetProvider = (): void => {
    instance = null
}
