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

const STORE_NAME = 'network-store'

const SUPPORTED_NETWORKS = new Set<string>(Object.values(Networks))

/**
 * Guards rehydration against a persisted value that is no longer a union member
 * — e.g. a device that selected 'fnet' or 'localnet' before those were replaced
 * by the custom slot. Without this, the unknown string flows into
 * getNetworkConfig, which returns undefined and crashes the chain-table lookup.
 */
export const mergePersistedNetwork = (
    persisted: unknown,
): { network: Network } => {
    const network = (persisted as { network?: unknown } | null | undefined)
        ?.network

    return {
        network:
            typeof network === 'string' && SUPPORTED_NETWORKS.has(network)
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
            // Spread over `current` deliberately: mergePersistedNetwork returns
            // only { network }, so returning it directly would drop setNetwork
            // and resetState from the rehydrated store.
            merge: (persisted, current) => ({
                ...current,
                ...mergePersistedNetwork(persisted),
            }),
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
