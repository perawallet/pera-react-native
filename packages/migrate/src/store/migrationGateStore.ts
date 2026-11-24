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

import { create } from 'zustand'
import {
    guardedPersist,
    registerStore,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { MigrationStepVersions } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'migration-gate-store'

/** A refused legacy wipe: it is re-checked once a step version moves or none of `addresses` blocks any more. */
export type LegacyWipeBlock = {
    versions: MigrationStepVersions
    /** Migrated addresses whose key was held only as watch or was missing from the keystore. */
    addresses: string[]
}

type MigrationGateState = {
    isChecking: boolean
    needsMigration: boolean
    dismissed: boolean
    hasStarted: boolean
    skipped: boolean
    legacyWipeBlock: Nullable<LegacyWipeBlock>
}

type MigrationGateActions = {
    setLegacyWipeBlock: (block: Nullable<LegacyWipeBlock>) => void
    markStarted: () => void
    setStatus: (input: { needsMigration: boolean }) => void
    dismiss: () => void
    setSkipped: () => void
    clearSkipped: () => void
    resetState: () => void
}

type MigrationGateStore = MigrationGateState & MigrationGateActions

const initialState: MigrationGateState = {
    isChecking: true,
    needsMigration: false,
    dismissed: false,
    hasStarted: false,
    skipped: false,
    legacyWipeBlock: null,
}

export const useMigrationGateStore = create<MigrationGateStore>()(
    guardedPersist(
        set => ({
            ...initialState,
            markStarted: () => set({ hasStarted: true }),
            setStatus: ({ needsMigration }) =>
                set({ needsMigration, isChecking: false }),
            dismiss: () => set({ dismissed: true }),
            setSkipped: () => set({ skipped: true }),
            clearSkipped: () => set({ skipped: false }),
            setLegacyWipeBlock: block => set({ legacyWipeBlock: block }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            // Only `skipped` and the wipe verdict survive cold launches.
            // Session-local fields (isChecking, needsMigration, dismissed,
            // hasStarted) re-evaluate on every launch.
            partialize: state => ({
                skipped: state.skipped,
                legacyWipeBlock: state.legacyWipeBlock,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useMigrationGateStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useMigrationGateStore.getState().resetState(),
})
