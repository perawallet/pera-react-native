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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { AgeGateSource, AgeGateStatus } from '../models'

const STORE_NAME = 'age-gate-store'

type AgeGateState = {
    status: AgeGateStatus | null
    source: AgeGateSource | null
}

type AgeGateActions = {
    setDecision: (status: AgeGateStatus, source: AgeGateSource) => void
    resetState: () => void
}

type AgeGateStore = AgeGateState & AgeGateActions

const initialState: AgeGateState = {
    status: null,
    source: null,
}

export const useAgeGateStore: UseBoundStore<
    WithPersist<StoreApi<AgeGateStore>, unknown>
> = create<AgeGateStore>()(
    persist(
        set => ({
            ...initialState,
            setDecision: (status, source) => set({ status, source }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                status: state.status,
                source: state.source,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useAgeGateStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useAgeGateStore.getState().resetState(),
})
