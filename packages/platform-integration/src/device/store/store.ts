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
import type { DeviceState } from '../models'
import {
    createLazyStore,
    DataStoreRegistry,
    logger,
    type Network,
    type WithPersist,
} from '@perawallet/wallet-core-shared'

const STORE_NAME = 'device-store'

const objectToDeviceIDs = (
    object: Record<string, string | null>,
): Map<Network, string | null> => {
    const map = new Map<Network, string | null>()
    Object.entries(object).forEach(([key, value]) => {
        map.set(key as Network, value)
    })
    return map
}

// Rehydration function to convert persisted object back to Map
const rehydrateDeviceSlice = (
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    persistedState: any,
): Partial<DeviceState> => {
    if (persistedState) {
        return {
            ...persistedState,
            deviceIDs: objectToDeviceIDs(persistedState.deviceIDs),
        }
    }
    return persistedState
}

const lazy = createLazyStore<WithPersist<StoreApi<DeviceState>, unknown>>()

export const useDeviceStore: UseBoundStore<
    WithPersist<StoreApi<DeviceState>, unknown>
> = lazy.useStore

const initialState = {
    deviceIDs: new Map<Network, string | null>(),
    pushToken: null as string | null,
    network: 'mainnet' as Network,
}

export const createDeviceStore = (storage: KeyValueStorageService) =>
    create<DeviceState>()(
        persist(
            (set, get) => ({
                ...initialState,
                setPushToken: (token: string | null) => {
                    set({ pushToken: token })
                },
                setDeviceID: (network: Network, id: string | null) => {
                    const deviceIDs = get().deviceIDs
                    deviceIDs.set(network, id)
                    set({ deviceIDs })
                },
                setNetwork: (network: Network) => {
                    set({ network })
                },
                resetState: () =>
                    set({
                        deviceIDs: new Map<Network, string | null>(),
                        pushToken: null,
                        network: 'mainnet',
                    }),
            }),
            {
                name: 'device-store',
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    deviceIDs: state.deviceIDs,
                    pushToken: state.pushToken,
                    network: state.network,
                }),
                onRehydrateStorage: () => state => {
                    if (state) {
                        // Rehydrate device slice to convert deviceIDs back to Map
                        const deviceState = rehydrateDeviceSlice(state)
                        Object.assign(state, deviceState)
                    }
                },
            },
        ),
    )

export const initDeviceStore = () => {
    logger.debug('Initializing device store')
    const storage = useKeyValueStorageService()
    const realStore = createDeviceStore(storage)
    lazy.init(realStore, () => realStore.getState().resetState())
    logger.debug('Device store initialized')
}

export const clearDeviceStore = () => lazy.clear()

DataStoreRegistry.register({
    name: STORE_NAME,
    init: initDeviceStore,
    clear: clearDeviceStore,
})
