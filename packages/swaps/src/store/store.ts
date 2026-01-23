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
import type { SwapsState } from '../models'
import type { WithPersist } from '@perawallet/wallet-core-shared'
import {
    KeyValueStorageService,
    useKeyValueStorageService,
} from '@perawallet/wallet-core-platform-integration'
import {
    createLazyStore,
    DataStoreRegistry,
    logger,
} from '@perawallet/wallet-core-shared'

const STORE_NAME = 'swaps-store'
const lazy = createLazyStore<WithPersist<StoreApi<SwapsState>, unknown>>()

export const useSwapsStore: UseBoundStore<
    WithPersist<StoreApi<SwapsState>, unknown>
> = lazy.useStore

const initialState = {
    fromAsset: '0',
    toAsset: '1001',
}

const createSwapsStore = (storage: KeyValueStorageService) =>
    create<SwapsState>()(
        persist(
            set => ({
                ...initialState,
                setFromAsset: (fromAsset: string) => set({ fromAsset }),
                setToAsset: (toAsset: string) => set({ toAsset }),
                resetState: () => set(initialState),
            }),
            {
                name: 'swaps-store',
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    fromAsset: state.fromAsset,
                    toAsset: state.toAsset,
                }),
            },
        ),
    )

export const initSwapsStore = () => {
    logger.debug('Initializing swaps store')
    const storage = useKeyValueStorageService()
    const realStore = createSwapsStore(storage)
    lazy.init(realStore, () => realStore.getState().resetState())
    logger.debug('Swaps store initialized')
}

export const clearSwapsStore = () => lazy.clear()

DataStoreRegistry.register({
    name: STORE_NAME,
    init: initSwapsStore,
    clear: clearSwapsStore,
})
