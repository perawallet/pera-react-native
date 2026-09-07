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
import type { CurrenciesStore } from '../models'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { USD_CURRENCY_ID } from '../constants'

const STORE_NAME = 'currencies-store'

const initialState = {
    preferredCurrency: USD_CURRENCY_ID,
    fallbackCurrency: USD_CURRENCY_ID,
}

export const useCurrenciesStore: UseBoundStore<
    WithPersist<StoreApi<CurrenciesStore>, unknown>
> = create<CurrenciesStore>()(
    persist(
        set => ({
            ...initialState,
            setPreferredCurrency: (currency: string) =>
                set({ preferredCurrency: currency }),
            setFallbackCurrency: (currency: string) =>
                set({ fallbackCurrency: currency }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                preferredCurrency: state.preferredCurrency,
                fallbackCurrency: state.fallbackCurrency,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useCurrenciesStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useCurrenciesStore.getState().resetState(),
})
