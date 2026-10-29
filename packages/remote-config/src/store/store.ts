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
import type { RemoteConfigStore } from '../models'
import {
    guardedPersist,
    registerStore,
    type WithPersist,
    type Nullable,
    type QuarantinableStorage,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'remote-config-store'

const getInitialState = (): Pick<RemoteConfigStore, 'configOverrides'> => ({
    configOverrides: {},
})

export const createRemoteConfigStore = (storage: QuarantinableStorage) =>
    create<RemoteConfigStore>()(
        guardedPersist(
            (set, get) => ({
                ...getInitialState(),
                setConfigOverride: (
                    key: string,
                    value: Nullable<string | boolean | number>,
                ) => {
                    const configOverrides = { ...get().configOverrides }
                    if (value === null) {
                        delete configOverrides[key]
                    } else {
                        configOverrides[key] = value
                    }
                    set({ configOverrides })
                },
                resetState: () => set(getInitialState()),
            }),
            {
                name: STORE_NAME,
                storage: () => storage,
                version: 1,
                partialize: state => ({
                    configOverrides: state.configOverrides,
                }),
            },
        ),
    )

export const useRemoteConfigStore: UseBoundStore<
    WithPersist<StoreApi<RemoteConfigStore>, unknown>
> = create<RemoteConfigStore>()(
    guardedPersist(
        (set, get) => ({
            ...getInitialState(),
            setConfigOverride: (
                key: string,
                value: Nullable<string | boolean | number>,
            ) => {
                const configOverrides = { ...get().configOverrides }
                if (value === null) {
                    delete configOverrides[key]
                } else {
                    configOverrides[key] = value
                }
                set({ configOverrides })
            },
            resetState: () => set(getInitialState()),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            version: 1,
            partialize: state => ({
                configOverrides: state.configOverrides,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useRemoteConfigStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useRemoteConfigStore.getState().resetState(),
})
