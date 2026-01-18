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
import { createLazyStore, logger } from '@perawallet/wallet-core-shared'

const lazy = createLazyStore<WithPersist<StoreApi<SecurityState>, unknown>>()

export const useSecurityStore: UseBoundStore<
    WithPersist<StoreApi<SecurityState>, unknown>
> = lazy.useStore

const initialState = {
    isPinEnabled: false,
    isBiometricEnabled: false,
    failedAttempts: 0,
    lockoutEndTime: null,
    lastBackgroundTime: null,
}

const createSecurityStore = (storage: KeyValueStorageService) =>
    create<SecurityState>()(
        persist(
            set => ({
                ...initialState,
                setIsPinEnabled: (enabled: boolean) =>
                    set({ isPinEnabled: enabled }),
                setIsBiometricEnabled: (enabled: boolean) =>
                    set({ isBiometricEnabled: enabled }),
                incrementFailedAttempts: () =>
                    set(state => ({
                        failedAttempts: state.failedAttempts + 1,
                    })),
                resetFailedAttempts: () => set({ failedAttempts: 0 }),
                setLockoutEndTime: (time: number | null) =>
                    set({ lockoutEndTime: time }),
                setLastBackgroundTime: (time: number | null) =>
                    set({ lastBackgroundTime: time }),
                reset: () => set(initialState),
            }),
            {
                name: 'security-store',
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    isPinEnabled: state.isPinEnabled,
                    isBiometricEnabled: state.isBiometricEnabled,
                    failedAttempts: state.failedAttempts,
                    lockoutEndTime: state.lockoutEndTime,
                    lastBackgroundTime: state.lastBackgroundTime,
                }),
            },
        ),
    )

export const initSecurityStore = () => {
    logger.debug('Initializing security store')
    const storage = useKeyValueStorageService()
    const realStore = createSecurityStore(storage)
    lazy.init(realStore)
    logger.debug('Security store initialized')
}
