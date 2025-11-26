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
import { useKeyValueStorageService } from '../../storage'
import type { DeviceState } from '../models'
import type { Network, WithPersist } from '@perawallet/wallet-core-shared'

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

export const useDeviceStore: UseBoundStore<
    WithPersist<StoreApi<DeviceState>, unknown>
> = create<DeviceState>()(
    persist(
        (set, get) => ({
            deviceIDs: new Map(),
            fcmToken: null,
            network: 'mainnet',
            setFcmToken: (token: string | null) => {
                set({ fcmToken: token })
            },
            setDeviceID: (network: Network, id: string | null) => {
                const deviceIDs = get().deviceIDs
                deviceIDs.set(network, id)
                set({ deviceIDs })
            },
            setNetwork: (network: Network) => {
                set({ network })
            },
        }),
        {
            name: 'device-store',
            storage: createJSONStorage(useKeyValueStorageService),
            version: 1,
            partialize: state => ({
                deviceIDs: state.deviceIDs,
                fcmToken: state.fcmToken,
                network: state.network,
            }),
            onRehydrateStorage: state => {
                if (state) {
                    // Rehydrate device slice to convert deviceIDs back to Map
                    const deviceState = rehydrateDeviceSlice(state)
                    Object.assign(state, deviceState)
                }
            },
        },
    ),
)
