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

const STORE_NAME = 'node-override-store'

/**
 * Per-network algod/indexer endpoint overrides. Needed because LocalNet's
 * baked `http://localhost:4001` is unreachable from a physical device (which
 * needs the host's LAN address), and because fnet resets can move endpoints
 * without a rebuild. Absent keys mean "use the baked chain config".
 */
export type NodeEndpointOverride = {
    algodUrl?: string
    indexerUrl?: string
}

type NodeOverrideState = BaseStoreState & {
    overrides: Partial<Record<Network, NodeEndpointOverride>>
    setOverride: (network: Network, override: NodeEndpointOverride) => void
    clearOverride: (network: Network) => void
}

const initialState = {
    overrides: {} as Partial<Record<Network, NodeEndpointOverride>>,
}

export const useNodeOverrideStore: UseBoundStore<
    WithPersist<StoreApi<NodeOverrideState>, unknown>
> = create<NodeOverrideState>()(
    persist(
        set => ({
            ...initialState,
            setOverride: (network, override) =>
                set(state => ({
                    overrides: {
                        ...state.overrides,
                        [network]: {
                            ...state.overrides[network],
                            ...override,
                        },
                    },
                })),
            clearOverride: network =>
                set(state => {
                    const next = { ...state.overrides }
                    delete next[network]
                    return { overrides: next }
                }),
            resetState: () => set({ ...initialState, overrides: {} }),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({ overrides: state.overrides }),
        },
    ),
)

/** Non-hook read, for the client factories that run outside React. */
export const getNodeEndpointOverride = (
    network: Network,
): NodeEndpointOverride | undefined =>
    useNodeOverrideStore.getState().overrides[network]

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useNodeOverrideStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useNodeOverrideStore.getState().resetState(),
})
