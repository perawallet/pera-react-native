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
import {
    KeyValueStorageService,
    useKeyValueStorageService,
} from '@perawallet/wallet-core-platform-extension'
import {
    createLazyStore,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { CurrenciesStore } from '../models'

const STORE_NAME = 'currencies-store'
const lazy =
    createLazyStore<WithPersist<StoreApi<CurrenciesStore>, unknown>>(STORE_NAME)

export const useCurrenciesStore: UseBoundStore<
    WithPersist<StoreApi<CurrenciesStore>, unknown>
> = lazy.useStore

const initialState = {
    preferredCurrency: 'USD',
    fallbackCurrency: 'USD',
}

const createCurrenciesStore = (storage: KeyValueStorageService) =>
    create<CurrenciesStore>()(
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
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    preferredCurrency: state.preferredCurrency,
                    fallbackCurrency: state.fallbackCurrency,
                }),
            },
        ),
    )

export const initCurrenciesStore = () => {
    const storage = useKeyValueStorageService()
    const realStore = createCurrenciesStore(storage)
    lazy.init(realStore, () => realStore.getState().resetState())
}

export const clearCurrenciesStore = () => lazy.clear()
