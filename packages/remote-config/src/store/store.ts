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
import {
    persist,
    createJSONStorage,
    type StateStorage,
} from 'zustand/middleware'
import type { RemoteConfigStore } from '../models'
import {
    logger,
    registerStore,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'remote-config-store'
const TAG = '[RemoteConfigStore]'

const getInitialState = (): Pick<RemoteConfigStore, 'configOverrides'> => ({
    configOverrides: {},
})

export const createRemoteConfigStore = (storage: StateStorage) =>
    create<RemoteConfigStore>()(
        persist(
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
                storage: createJSONStorage(() => storage),
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
    persist(
        (set, get) => ({
            ...getInitialState(),
            setConfigOverride: (
                key: string,
                value: Nullable<string | boolean | number>,
            ) => {
                logger.debug(`${TAG} setConfigOverride("${key}", ${value})`)
                const configOverrides = { ...get().configOverrides }
                if (value === null) {
                    delete configOverrides[key]
                } else {
                    configOverrides[key] = value
                }
                set({ configOverrides })
            },
            resetState: () => {
                logger.debug(`${TAG} resetState() called`)
                set(getInitialState())
            },
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                configOverrides: state.configOverrides,
            }),
            onRehydrateStorage: () => {
                logger.debug(`${TAG} rehydration starting`)
                return (state, error) => {
                    if (error) {
                        logger.debug(`${TAG} rehydration ERROR:`, { error })
                    } else {
                        logger.debug(
                            `${TAG} rehydration complete, configOverrides:`,
                            state?.configOverrides,
                        )
                    }
                }
            },
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
