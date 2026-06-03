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
import type { AppIntegrityStore } from '../models'

const STORE_NAME = 'app-integrity-store'

const initialState = {
    integrityToken: null,
    expiresAt: null,
    keyId: null,
    deviceId: null,
    status: 'idle' as const,
    lastError: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
}

export const useAppIntegrityStore: UseBoundStore<
    WithPersist<StoreApi<AppIntegrityStore>, unknown>
> = create<AppIntegrityStore>()(
    persist(
        set => ({
            ...initialState,
            setRegistration: ({ integrityToken, expiresAt, keyId, deviceId }) =>
                set({
                    integrityToken,
                    expiresAt,
                    keyId,
                    deviceId,
                    status: 'success',
                    lastError: null,
                    lastSuccessAt: new Date().toISOString(),
                }),
            setStatus: status => set({ status }),
            setError: message => set({ status: 'error', lastError: message }),
            setLastAttemptAt: iso => set({ lastAttemptAt: iso }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                integrityToken: state.integrityToken,
                expiresAt: state.expiresAt,
                keyId: state.keyId,
                deviceId: state.deviceId,
                status: state.status,
                lastError: state.lastError,
                lastAttemptAt: state.lastAttemptAt,
                lastSuccessAt: state.lastSuccessAt,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useAppIntegrityStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useAppIntegrityStore.getState().resetState(),
})
