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
import type { DeviceIdOrigin, DeviceState } from '../models'
import {
    networkTierForMode,
    scopeFromNetworkColumn,
    scopeKeyLegacyNetworkRecord,
    toScopeKey,
    type ChainScopeKey,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import {
    guardedPersist,
    registerStore,
    type WithPersist,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'device-store'

const objectToDeviceIDs = (
    object: Optional<Partial<Record<string, Nullable<string>>>>,
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
            deviceIDs: scopeKeyLegacyNetworkRecord(state.deviceIDs),
            deviceIdOrigins: scopeKeyLegacyNetworkRecord(state.deviceIdOrigins),
        }
    }
    return state
}

// Ids keep the key the v2 migration gave them: the deployment's legacy-chain scope key.
const deviceStorageKey = (deployment: WalletMode): ChainScopeKey =>
    toScopeKey(scopeFromNetworkColumn(networkTierForMode(deployment)))

/** A device id belongs to a Pera deployment, never a chain. */
export const deviceIdForDeployment = (
    state: Pick<DeviceState, 'deviceIDs'>,
    deployment: WalletMode,
): Nullable<string> =>
    state.deviceIDs?.get(deviceStorageKey(deployment)) ?? null

export const deviceIdOriginFor = (
    state: Pick<DeviceState, 'deviceIdOrigins'>,
    deployment: WalletMode,
): Optional<DeviceIdOrigin> =>
    state.deviceIdOrigins[deviceStorageKey(deployment)]

const initialState = {
    deviceIDs: new Map<ChainScopeKey, Nullable<string>>(),
    pushToken: null as Nullable<string>,
    pendingRegistrationDeployments: [] as WalletMode[],
    deviceIdOrigins: {} as Partial<Record<ChainScopeKey, DeviceIdOrigin>>,
}

export const useDeviceStore: UseBoundStore<
    WithPersist<StoreApi<DeviceState>, unknown>
> = create<DeviceState>()(
    guardedPersist(
        (set, get) => ({
            ...initialState,
            setPushToken: (token: Nullable<string>) => {
                set({ pushToken: token })
            },
            setDeviceID: (deployment: WalletMode, id: Nullable<string>) => {
                const deviceIDs = new Map(get().deviceIDs)
                deviceIDs.set(deviceStorageKey(deployment), id)
                set({ deviceIDs })
            },
            setRegistrationPending: (
                deployment: WalletMode,
                isPending: boolean,
            ) => {
                const current = get().pendingRegistrationDeployments
                if (isPending === current.includes(deployment)) return
                set({
                    pendingRegistrationDeployments: isPending
                        ? [...current, deployment]
                        : current.filter(pending => pending !== deployment),
                })
            },
            setDeviceIdOrigin: (
                deployment: WalletMode,
                origin: DeviceIdOrigin,
            ) => {
                set({
                    deviceIdOrigins: {
                        ...get().deviceIdOrigins,
                        [deviceStorageKey(deployment)]: origin,
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
            storage: () => getProvider().keyValueStorage,
            version: 2,
            migrate: migrateDeviceState,
            // pendingRegistrationDeployments is deliberately not persisted: the
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
