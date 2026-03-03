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
import { keyValueStorage } from '@perawallet/wallet-extension-platform-resources'
import type { SwapsState } from '../models'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'

const STORE_NAME = 'swaps-store'

const initialState = {
    fromAsset: '0',
    toAsset: '1001',
}

export const useSwapsStore: UseBoundStore<
    WithPersist<StoreApi<SwapsState>, unknown>
> = create<SwapsState>()(
    persist(
        set => ({
            ...initialState,
            setFromAsset: (fromAsset: string) => set({ fromAsset }),
            setToAsset: (toAsset: string) => set({ toAsset }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => keyValueStorage),
            version: 1,
            partialize: state => ({
                fromAsset: state.fromAsset,
                toAsset: state.toAsset,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useSwapsStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSwapsStore.getState().resetState(),
})
