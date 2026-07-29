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
import {
    registerStore,
    type Network,
    type BaseStoreState,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { config, Networks } from '@perawallet/wallet-core-config'
import { isCustomNetworkConfigured } from './custom-network-store'

const STORE_NAME = 'network-store'

const SUPPORTED_NETWORKS = new Set<string>(Object.values(Networks))

/**
 * Guards rehydration on two counts.
 *
 * 1. A persisted value that is no longer a union member — e.g. a device that
 *    selected 'fnet' or 'localnet' before those were replaced by the custom
 *    slot. The unknown string would flow into `getNetworkConfig`, whose
 *    chain-table lookup misses and yields `{ algodUrl: undefined, … }`
 *    (spreading `undefined` is a legal no-op, so nothing fails here); the throw
 *    lands later, at client construction, far from the cause.
 * 2. A persisted `'custom'` whose config is not there. The two stores can
 *    diverge — a corrupt or absent `custom-network-store` entry, an interrupted
 *    write — and `custom` is the one member with no baked fallback, so every
 *    endpoint resolves to `''` and `TimeoutHttpClient`'s `new URL('/')` throws
 *    inside `useAlgorandClient`'s `useMemo`: an uncaught throw during render.
 *
 * The `custom` check reads the sibling store, which the static import above
 * guarantees is created — and therefore hydrated, since every
 * `KeyValueStorageService` implementation is synchronous — before this module
 * evaluates.
 */
export const mergePersistedNetwork = (
    persisted: unknown,
): { network: Network } => {
    const network = (persisted as { network?: unknown } | null | undefined)
        ?.network

    const isUsable =
        typeof network === 'string' &&
        SUPPORTED_NETWORKS.has(network) &&
        (network !== Networks.custom || isCustomNetworkConfigured())

    return {
        network: isUsable
            ? (network as Network)
            : (config.defaultNetwork as Network),
    }
}

type NetworkState = BaseStoreState & {
    network: Network
    setNetwork: (network: Network) => void
}

const initialState = {
    network: config.defaultNetwork as Network,
}

export const useNetworkStore: UseBoundStore<
    WithPersist<StoreApi<NetworkState>, unknown>
> = create<NetworkState>()(
    persist(
        set => ({
            ...initialState,
            setNetwork: (network: Network) => set({ network }),
            resetState: () => set({ ...initialState }),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({ network: state.network }),
            merge: (persisted, current) => {
                // zustand calls `merge` unconditionally — including on a first
                // launch where storage held nothing — and applies the result
                // with replace:true. There is no persisted value to guard in
                // that case, and forcing config.defaultNetwork here would
                // overwrite whatever the current state holds.
                if (persisted === undefined || persisted === null) {
                    return current
                }

                // Spread over `current` deliberately: mergePersistedNetwork
                // returns only { network }, so returning it directly would drop
                // setNetwork and resetState from the rehydrated store.
                return { ...current, ...mergePersistedNetwork(persisted) }
            },
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useNetworkStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useNetworkStore.getState().resetState(),
})
