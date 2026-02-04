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
} from '../../storage'
import type { RemoteConfigStore } from '../models'
import {
    createLazyStore,
    DataStoreRegistry,
    logger,
    type WithPersist,
} from '@perawallet/wallet-core-shared'

const STORE_NAME = 'remote-config-store'

const lazy =
    createLazyStore<WithPersist<StoreApi<RemoteConfigStore>, unknown>>(STORE_NAME)

export const useRemoteConfigStore: UseBoundStore<
    WithPersist<StoreApi<RemoteConfigStore>, unknown>
> = lazy.useStore

const initialState = {
    configOverrides: {} as Record<string, string | boolean | number>,
}

export const createRemoteConfigStore = (storage: KeyValueStorageService) =>
    create<RemoteConfigStore>()(
        persist(
            (set, get) => ({
                ...initialState,
                setConfigOverride: (
                    key: string,
                    value: string | boolean | number | null,
                ) => {
                    const configOverrides = get().configOverrides
                    if (value === null) {
                        delete configOverrides[key]
                    } else {
                        configOverrides[key] = value
                    }
                    set({ configOverrides: { ...configOverrides } })
                },
                resetState: () => set(initialState),
            }),
            {
                name: 'remote-config-store',
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    configOverrides: state.configOverrides,
                }),
            },
        ),
    )

export const initRemoteConfigStore = () => {
    logger.debug('Initializing remote config store')
    const storage = useKeyValueStorageService()
    const realStore = createRemoteConfigStore(storage)
    lazy.init(realStore, () => realStore.getState().resetState())
    logger.debug('Remote config store initialized')
}

export const clearRemoteConfigStore = () => lazy.clear()

export const registerRemoteConfigStore = () =>
    DataStoreRegistry.register({
        name: STORE_NAME,
        init: initRemoteConfigStore,
        clear: clearRemoteConfigStore,
    })
