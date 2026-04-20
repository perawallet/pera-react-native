/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { BackupStore } from '../models'

const STORE_NAME = 'backup-store'

const initialState = {
    backedUpKeyIds: {} as Record<string, boolean>,
}

export const useBackupStore: UseBoundStore<
    WithPersist<StoreApi<BackupStore>, unknown>
> = create<BackupStore>()(
    persist(
        (set, get) => ({
            ...initialState,
            markBackedUp: (keyId: string) => {
                set({
                    backedUpKeyIds: {
                        ...get().backedUpKeyIds,
                        [keyId]: true,
                    },
                })
            },
            markMultipleBackedUp: (keyIds: string[]) => {
                const current = get().backedUpKeyIds
                const next = { ...current }
                for (const id of keyIds) {
                    next[id] = true
                }
                set({ backedUpKeyIds: next })
            },
            isBackedUp: (keyId: string | null | undefined) => {
                if (!keyId) return false
                return !!get().backedUpKeyIds[keyId]
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                backedUpKeyIds: state.backedUpKeyIds,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useBackupStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useBackupStore.getState().resetState(),
})
