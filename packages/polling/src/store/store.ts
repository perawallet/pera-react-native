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
    type KeyValueStorageService,
    useKeyValueStorageService,
} from '@perawallet/wallet-core-platform-integration'
import {
    createLazyStore,
    DataStoreRegistry,
    logger,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { PollingState } from '../models'

const STORE_NAME = 'polling-store'

const lazy = createLazyStore<WithPersist<StoreApi<PollingState>, unknown>>()

export const usePollingStore: UseBoundStore<
    WithPersist<StoreApi<PollingState>, unknown>
> = lazy.useStore

const initialState = {
    lastRefreshedRound: null as number | null,
}

export const createPollingStore = (storage: KeyValueStorageService) =>
    create<PollingState>()(
        persist(
            set => ({
                ...initialState,
                setLastRefreshedRound: (round: number | null) => {
                    set({ lastRefreshedRound: round })
                },
                resetState: () => set(initialState),
            }),
            {
                name: 'polling-store',
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    lastRefreshedRound: state.lastRefreshedRound,
                }),
            },
        ),
    )

export const initPollingStore = () => {
    logger.debug('Initializing polling store')
    const storage = useKeyValueStorageService()
    const realStore = createPollingStore(storage)
    lazy.init(realStore, () => realStore.getState().resetState())
    logger.debug('Polling store initialized')
}

export const clearPollingStore = () => lazy.clear()

export const registerPollingStore = () =>
    DataStoreRegistry.register({
        name: STORE_NAME,
        init: initPollingStore,
        clear: clearPollingStore,
    })
