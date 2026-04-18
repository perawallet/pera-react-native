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
import type { SecurityState } from '../models'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'security-store'

const initialState = {
    failedAttempts: 0,
    lockoutEndTime: null,
    autoLockStartedAt: null,
}

export const useSecurityStore: UseBoundStore<
    WithPersist<StoreApi<SecurityState>, unknown>
> = create<SecurityState>()(
    persist(
        set => ({
            ...initialState,
            incrementFailedAttempts: () =>
                set(state => ({
                    failedAttempts: state.failedAttempts + 1,
                })),
            setFailedAttempts: (count: number) =>
                set({ failedAttempts: count }),
            resetFailedAttempts: () => set({ failedAttempts: 0 }),
            setLockoutEndTime: (time: number | null) =>
                set({ lockoutEndTime: time }),
            setAutoLockStartedAt: (date: number | null) =>
                set({ autoLockStartedAt: date }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                autoLockStartedAt: state.autoLockStartedAt,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useSecurityStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSecurityStore.getState().resetState(),
})
