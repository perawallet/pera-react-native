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
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DeviceState } from '../models'
import {
    registerStore,
    type Network,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'device-store'

const objectToDeviceIDs = (
    object: Record<string, Nullable<string>>,
): Map<Network, Nullable<string>> => {
    const map = new Map<Network, Nullable<string>>()
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

const initialState = {
    deviceIDs: new Map<Network, Nullable<string>>(),
    pushToken: null as Nullable<string>,
    pendingRegistrationNetworks: [] as Network[],
}

export const useDeviceStore: UseBoundStore<
    WithPersist<StoreApi<DeviceState>, unknown>
> = create<DeviceState>()(
    persist(
        (set, get) => ({
            ...initialState,
            setPushToken: (token: Nullable<string>) => {
                set({ pushToken: token })
            },
            setDeviceID: (network: Network, id: Nullable<string>) => {
                const deviceIDs = new Map(get().deviceIDs)
                deviceIDs.set(network, id)
                set({ deviceIDs })
            },
            setRegistrationPending: (network: Network, isPending: boolean) => {
                const current = get().pendingRegistrationNetworks
                if (isPending === current.includes(network)) return
                set({
                    pendingRegistrationNetworks: isPending
                        ? [...current, network]
                        : current.filter(pending => pending !== network),
                })
            },
            resetState: () =>
                set({
                    ...initialState,
                    deviceIDs: new Map(),
                }),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            // pendingRegistrationNetworks is deliberately not persisted: the
            // mount effect re-registers on every cold start anyway, and a
            // rehydrated pending flag would arm the retry subscriptions before
            // that first attempt resolves.
            partialize: state => ({
                deviceIDs: Object.fromEntries(state.deviceIDs),
                pushToken: state.pushToken,
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

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useDeviceStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useDeviceStore.getState().resetState(),
})
