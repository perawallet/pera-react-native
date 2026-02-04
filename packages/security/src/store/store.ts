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
import type { WithPersist } from '@perawallet/wallet-core-shared'
import {
    type KeyValueStorageService,
    useKeyValueStorageService,
} from '@perawallet/wallet-core-platform-integration'
import {
    createLazyStore,
    DataStoreRegistry,
} from '@perawallet/wallet-core-shared'

const STORE_NAME = 'security-store'
const lazy = createLazyStore<WithPersist<StoreApi<SecurityState>, unknown>>(STORE_NAME)

export const useSecurityStore: UseBoundStore<
    WithPersist<StoreApi<SecurityState>, unknown>
> = lazy.useStore

const initialState = {
    failedAttempts: 0,
    lockoutEndTime: null,
    autoLockStartedAt: null,
}

const createSecurityStore = (storage: KeyValueStorageService) =>
    create<SecurityState>()(
        persist(
            set => ({
                ...initialState,
                incrementFailedAttempts: () =>
                    set(state => ({
                        failedAttempts: state.failedAttempts + 1,
                    })),
                resetFailedAttempts: () => set({ failedAttempts: 0 }),
                setLockoutEndTime: (time: number | null) =>
                    set({ lockoutEndTime: time }),
                setAutoLockStartedAt: (date: number | null) =>
                    set({ autoLockStartedAt: date }),
                resetState: () => set(initialState),
            }),
            {
                name: STORE_NAME,
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    failedAttempts: state.failedAttempts,
                    lockoutEndTime: state.lockoutEndTime,
                    autoLockStartedAt: state.autoLockStartedAt,
                }),
            },
        ),
    )

export const initSecurityStore = () => {
    const storage = useKeyValueStorageService()
    const realStore = createSecurityStore(storage)
    lazy.init(realStore, () => realStore.getState().resetState())
}

export const clearSecurityStore = () => lazy.clear()

export const registerSecurityStore = () =>
    DataStoreRegistry.register({
        name: STORE_NAME,
        init: initSecurityStore,
        clear: clearSecurityStore,
    })
