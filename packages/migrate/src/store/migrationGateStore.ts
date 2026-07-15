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
import { createJSONStorage, persist } from 'zustand/middleware'
import { registerStore } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'migration-gate-store'

type MigrationGateState = {
    isChecking: boolean
    needsMigration: boolean
    dismissed: boolean
    hasStarted: boolean
    skipped: boolean
}

type MigrationGateActions = {
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
}

export const useMigrationGateStore = create<MigrationGateStore>()(
    persist(
        set => ({
            ...initialState,
            markStarted: () => set({ hasStarted: true }),
            setStatus: ({ needsMigration }) =>
                set({ needsMigration, isChecking: false }),
            dismiss: () => set({ dismissed: true }),
            setSkipped: () => set({ skipped: true }),
            clearSkipped: () => set({ skipped: false }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            // Only `skipped` survives cold launches. Session-local fields
            // (isChecking, needsMigration, dismissed, hasStarted) re-evaluate
            // on every launch.
            partialize: state => ({ skipped: state.skipped }),
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
