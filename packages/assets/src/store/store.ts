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
import type { AssetsState } from '../models'
import {
    createLazyStore,
    logger,
    type WithPersist,
} from '@perawallet/wallet-core-shared'

const lazy = createLazyStore<WithPersist<StoreApi<AssetsState>, unknown>>()

export const useAssetsStore: UseBoundStore<
    WithPersist<StoreApi<AssetsState>, unknown>
> = lazy.useStore

const createAssetsStore = (storage: KeyValueStorageService) =>
    create<AssetsState>()(
        persist(
            set => ({
                assetIDs: [],
                setAssetIDs: (assetIDs: string[]) => {
                    set({ assetIDs })
                },
            }),
            {
                name: 'assets-store',
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    assetIDs: state.assetIDs,
                }),
            },
        ),
    )

export const initAssetsStore = () => {
    logger.debug('Initializing assets store')
    const storage = useKeyValueStorageService()
    const realStore = createAssetsStore(storage)
    lazy.init(realStore)
    logger.debug('Assets store initialized')
}

export { createAssetsStore }
