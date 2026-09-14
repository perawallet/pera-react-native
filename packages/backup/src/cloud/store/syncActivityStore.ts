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
import { registerStore } from '@perawallet/wallet-core-shared'
import type { BaseStoreState } from '@perawallet/wallet-core-shared'

type BackupSyncActivityState = BaseStoreState & {
    /** True while the manager holds the sync slot, for any reason — periodic,
     *  account-change, socket-driven pull, review action or the manual button. */
    isSyncing: boolean
}

type BackupSyncActivityActions = {
    setIsSyncing: (isSyncing: boolean) => void
}

export type BackupSyncActivityStore = BackupSyncActivityState &
    BackupSyncActivityActions

const initialState = { isSyncing: false }

/**
 * Deliberately not persisted: this describes a run that only exists inside the
 * current process. Killing the app mid-sync ends the sync, so the flag must
 * die with it rather than come back claiming work is still in flight.
 */
export const useBackupSyncActivityStore = create<BackupSyncActivityStore>()(
    set => ({
        ...initialState,
        setIsSyncing: isSyncing => set({ isSyncing }),
        resetState: () => set(initialState),
    }),
)

registerStore({
    name: 'backup-sync-activity-store',
    clearStorage: () => useBackupSyncActivityStore.getState().resetState(),
    resetState: () => useBackupSyncActivityStore.getState().resetState(),
})
