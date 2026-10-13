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
import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'
import type { RestoreProgress } from '../restore/restoreCloudBackup'

type CloudBackupRestoreProgressState = BaseStoreState & {
    progress: Nullable<RestoreProgress>
}

type CloudBackupRestoreProgressActions = {
    setProgress: (progress: Nullable<RestoreProgress>) => void
}

export type CloudBackupRestoreProgressStore = CloudBackupRestoreProgressState &
    CloudBackupRestoreProgressActions

const initialState = { progress: null }

export const useCloudBackupRestoreProgressStore =
    create<CloudBackupRestoreProgressStore>()(set => ({
        ...initialState,
        setProgress: progress => set({ progress }),
        resetState: () => set(initialState),
    }))

registerStore({
    name: 'cloud-backup-restore-progress-store',
    clearStorage: () =>
        useCloudBackupRestoreProgressStore.getState().resetState(),
    resetState: () =>
        useCloudBackupRestoreProgressStore.getState().resetState(),
})
