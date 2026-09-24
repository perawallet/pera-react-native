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

import {
    resolveBackupDeviceId,
    useBackupSyncActivityStore,
    useBackupSyncStateStore,
    useCloudBackupStore,
} from '../store'
import type { BackupSyncStatePort } from './types'

export const createBackupSyncStatePort = (): BackupSyncStatePort => ({
    getBackupId: () => useCloudBackupStore.getState().backupId,
    getDeviceId: resolveBackupDeviceId,
    getSyncState: () => useBackupSyncStateStore.getState().syncState,
    setSyncState: state =>
        useBackupSyncStateStore.getState().setSyncState(state),
    // Mirrored into the activity store so the UI can show background work — a
    // periodic tick, an account change or a socket-driven pull — not just the
    // runs it started itself.
    setIsSyncing: isSyncing =>
        useBackupSyncActivityStore.getState().setIsSyncing(isSyncing),
    reset: () => {
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useBackupSyncActivityStore.getState().resetState()
    },
})
