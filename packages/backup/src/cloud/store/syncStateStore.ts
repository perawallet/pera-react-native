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
import { guardedPersist, registerStore } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'
import type { SyncState } from '../models'

const STORE_NAME = 'backup-sync-state-store'

const initialState = { syncState: null as Nullable<SyncState> }

type BackupSyncStateState = BaseStoreState & {
    syncState: Nullable<SyncState>
}

type BackupSyncStateActions = {
    setSyncState: (syncState: Nullable<SyncState>) => void
}

type BackupSyncStateStore = BackupSyncStateState & BackupSyncStateActions

export const useBackupSyncStateStore = create<BackupSyncStateStore>()(
    guardedPersist(
        set => ({
            ...initialState,
            setSyncState: syncState => set({ syncState }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            version: 1,
            partialize: state => ({ syncState: state.syncState }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useBackupSyncStateStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useBackupSyncStateStore.getState().resetState(),
})
