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
    type BaseStoreState,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'custom-network-store'

/**
 * The one runtime-configurable network. Replaces the former per-network endpoint
 * overrides: if a developer wants a different node, that IS the custom network.
 *
 * Saved as a single unit, never merged — a half-updated chain config (new host,
 * stale genesis hash) would fail every signing attempt with a confusing
 * cross-network mismatch rather than anything pointing at the real cause.
 */
export type CustomNetworkConfig = {
    algodUrl: string
    algodToken?: string
    indexerUrl: string
    indexerToken?: string
    genesisHash: string
    genesisId: string
}

type CustomNetworkState = BaseStoreState & {
    customNetwork: CustomNetworkConfig | undefined
    setCustomNetwork: (config: CustomNetworkConfig) => void
    clearCustomNetwork: () => void
}

const initialState = {
    customNetwork: undefined as CustomNetworkConfig | undefined,
}

export const useCustomNetworkStore: UseBoundStore<
    WithPersist<StoreApi<CustomNetworkState>, unknown>
> = create<CustomNetworkState>()(
    persist(
        set => ({
            ...initialState,
            // Replace, never merge — see the type's docstring.
            setCustomNetwork: config => set({ customNetwork: config }),
            clearCustomNetwork: () => set({ customNetwork: undefined }),
            resetState: () => set({ customNetwork: undefined }),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({ customNetwork: state.customNetwork }),
        },
    ),
)

/** Non-hook read, for the client factories and resolvers that run outside React. */
export const getCustomNetworkConfig = (): CustomNetworkConfig | undefined =>
    useCustomNetworkStore.getState().customNetwork

/**
 * True once the custom slot has a saved config. The Custom radio is always
 * tappable (that is the only route into the config sheet), but `custom` must
 * never become the ACTIVE network until this is true.
 */
export const isCustomNetworkConfigured = (): boolean =>
    getCustomNetworkConfig() !== undefined

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useCustomNetworkStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useCustomNetworkStore.getState().resetState(),
})
