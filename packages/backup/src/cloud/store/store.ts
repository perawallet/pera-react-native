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
import { persist, createJSONStorage } from 'zustand/middleware'
import { registerStore } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { BaseStoreState } from '@perawallet/wallet-core-shared'
import type { CloudBackupActions, CloudBackupStore } from '../models'

const STORE_NAME = 'cloud-backup-store'

const initialState = {
    backupId: null as string | null,
    salt: null as string | null,
}

type SetState = (partial: Partial<CloudBackupStore>) => void
type GetState = () => CloudBackupStore

const createActions = (
    set: SetState,
    get: GetState,
): CloudBackupActions & BaseStoreState => ({
    setConfigured: ({ backupId, salt }) => set({ backupId, salt }),
    isConfigured: () => get().backupId != null,
    resetState: () => set(initialState),
})

const persistedState = (state: CloudBackupStore) => ({
    backupId: state.backupId,
    salt: state.salt,
})

export const useCloudBackupStore = create<CloudBackupStore>()(
    persist((set, get) => ({ ...initialState, ...createActions(set, get) }), {
        name: STORE_NAME,
        storage: createJSONStorage(() => getProvider().keyValueStorage),
        version: 1,
        partialize: persistedState,
    }),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useCloudBackupStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useCloudBackupStore.getState().resetState(),
})
