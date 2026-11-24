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
import type { PreparedCloudBackupRestore } from '../restore/restoreCloudBackup'

/** A restore waiting on the user's account choice. Memory only: what it holds
 *  is still sealed, and a restart has to start the restore over. */
export type CloudBackupRestoreSession = {
    prepared: PreparedCloudBackupRestore
    /** Base64 salt the backup is configured under once the restore lands. */
    salt: string
    credentialsConfirmed: boolean
}

type CloudBackupRestoreSessionState = BaseStoreState & {
    session: Nullable<CloudBackupRestoreSession>
}

type CloudBackupRestoreSessionActions = {
    setSession: (session: Nullable<CloudBackupRestoreSession>) => void
}

export type CloudBackupRestoreSessionStore = CloudBackupRestoreSessionState &
    CloudBackupRestoreSessionActions

const initialState = { session: null }

export const useCloudBackupRestoreSessionStore =
    create<CloudBackupRestoreSessionStore>()(set => ({
        ...initialState,
        setSession: session => set({ session }),
        resetState: () => set(initialState),
    }))

registerStore({
    name: 'cloud-backup-restore-session-store',
    clearStorage: () =>
        useCloudBackupRestoreSessionStore.getState().resetState(),
    resetState: () => useCloudBackupRestoreSessionStore.getState().resetState(),
})
