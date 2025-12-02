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
} from '@perawallet/wallet-core-platform-integration'
import {
    createLazyStore,
    debugLog,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { CurrenciesStore } from '../models'

const lazy = createLazyStore<WithPersist<StoreApi<CurrenciesStore>, unknown>>()

export const useCurrenciesStore: UseBoundStore<
    WithPersist<StoreApi<CurrenciesStore>, unknown>
> = lazy.useStore

const createCurrenciesStore = (storage: KeyValueStorageService) =>
    create<CurrenciesStore>()(
        persist(
            set => ({
                preferredCurrency: 'USD',
                setPreferredCurrency: (currency: string) =>
                    set({ preferredCurrency: currency }),
            }),
            {
                name: 'currencies-store',
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    preferredCurrency: state.preferredCurrency,
                }),
            },
        ),
    )

export const initCurrenciesStore = () => {
    debugLog('Initializing currencies store')
    const storage = useKeyValueStorageService()
    const realStore = createCurrenciesStore(storage)
    lazy.init(realStore)
    debugLog('Currencies store initialized')
}
