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
import type { BlockchainStore } from '../models'
import {
    createLazyStore,
    DataStoreRegistry,
    logger,
    type WithPersist,
} from '@perawallet/wallet-core-shared'

const STORE_NAME = 'blockchain-store'
const lazy = createLazyStore<WithPersist<StoreApi<BlockchainStore>, unknown>>(STORE_NAME)

export const useBlockchainStore: UseBoundStore<
    WithPersist<StoreApi<BlockchainStore>, unknown>
> = lazy.useStore

const createBlockchainStore = (storage: KeyValueStorageService) =>
    create<BlockchainStore>()(
        persist(
            set => ({
                resetState: () => set({}),
            }),
            {
                name: 'blockchain-store',
                storage: createJSONStorage(() => storage),
                version: 1,
            },
        ),
    )

export const initBlockchainStore = () => {
    logger.debug('Initializing blockchain store')
    const storage = useKeyValueStorageService()
    const realStore = createBlockchainStore(storage)
    lazy.init(realStore, () => realStore.getState().resetState())
    logger.debug('Blockchain store initialized')
}

export const clearBlockchainStore = () => lazy.clear()

export const registerBlockchainStore = () =>
    DataStoreRegistry.register({
        name: STORE_NAME,
        init: initBlockchainStore,
        clear: clearBlockchainStore,
    })
