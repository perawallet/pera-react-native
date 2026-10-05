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
import type { DeviceIdOrigin, DeviceState } from '../models'
import {
    rekeyLegacyNetworkRecord,
    scopeKeyForLegacyNetwork,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    registerStore,
    type Network,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'device-store'

const objectToDeviceIDs = (
    object: Partial<Record<string, Nullable<string>>> | undefined,
): Map<ChainScopeKey, Nullable<string>> =>
    new Map(Object.entries(object ?? {}) as [ChainScopeKey, Nullable<string>][])

type PersistedDeviceState = {
    deviceIDs?: Partial<Record<string, Nullable<string>>>
    pushToken?: Nullable<string>
    deviceIdOrigins?: Partial<Record<string, DeviceIdOrigin>>
}

/**
 * v1 keyed `deviceIDs` and `deviceIdOrigins` by the bare network; v2 keys them
 * by ChainScopeKey. Ids are carried over unchanged: losing one makes the next
 * registration mint a new backend device and orphans the old one's push
 * token and device-keyed server state.
 */
export const migrateDeviceState = (
    persistedState: unknown,
    version: number,
): PersistedDeviceState => {
    let state = (persistedState ?? {}) as PersistedDeviceState
    if (version < 2) {
        state = {
            ...state,
            deviceIDs: rekeyLegacyNetworkRecord(state.deviceIDs),
            deviceIdOrigins: rekeyLegacyNetworkRecord(state.deviceIdOrigins),
        }
    }
    return state
}

export const deviceIdFor = (
    state: Pick<DeviceState, 'deviceIDs'>,
    network: Network,
): Nullable<string> =>
    state.deviceIDs?.get(scopeKeyForLegacyNetwork(network)) ?? null

export const deviceIdOriginFor = (
    state: Pick<DeviceState, 'deviceIdOrigins'>,
    network: Network,
): DeviceIdOrigin | undefined =>
    state.deviceIdOrigins[scopeKeyForLegacyNetwork(network)]

const initialState = {
    deviceIDs: new Map<ChainScopeKey, Nullable<string>>(),
    pushToken: null as Nullable<string>,
    pendingRegistrationNetworks: [] as Network[],
    deviceIdOrigins: {} as Partial<Record<ChainScopeKey, DeviceIdOrigin>>,
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
                deviceIDs.set(scopeKeyForLegacyNetwork(network), id)
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
            setDeviceIdOrigin: (network: Network, origin: DeviceIdOrigin) => {
                set({
                    deviceIdOrigins: {
                        ...get().deviceIdOrigins,
                        [scopeKeyForLegacyNetwork(network)]: origin,
                    },
                })
            },
            resetState: () =>
                set({
                    ...initialState,
                    deviceIDs: new Map(),
                    deviceIdOrigins: {},
                }),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 2,
            migrate: migrateDeviceState,
            // pendingRegistrationNetworks is deliberately not persisted: the
            // mount effect re-registers on every cold start anyway, and a
            // rehydrated pending flag would arm the retry subscriptions before
            // that first attempt resolves.
            partialize: state => ({
                deviceIDs: Object.fromEntries(state.deviceIDs),
                pushToken: state.pushToken,
                deviceIdOrigins: state.deviceIdOrigins,
            }),
            // The Map is rebuilt here, not in onRehydrateStorage: after a
            // migration zustand writes the merged state back through
            // partialize before that callback runs, and partialize needs a Map.
            merge: (persistedState, currentState) => {
                if (!persistedState) return currentState
                const persisted = persistedState as PersistedDeviceState
                return {
                    ...currentState,
                    ...persisted,
                    deviceIDs: objectToDeviceIDs(persisted.deviceIDs),
                    deviceIdOrigins: persisted.deviceIdOrigins ?? {},
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
