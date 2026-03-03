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
    createLazyStore,
    type Network,
    type BaseStoreState,
} from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'

const STORE_NAME = 'network-store'

type NetworkState = BaseStoreState & {
    network: Network
    setNetwork: (network: Network) => void
}

const lazy = createLazyStore<StoreApi<NetworkState>>(STORE_NAME)

export const useNetworkStore: UseBoundStore<StoreApi<NetworkState>> =
    lazy.useStore

const initialState = {
    network: config.defaultNetwork as Network,
}

const createNetworkStore = () =>
    create<NetworkState>(set => ({
        ...initialState,
        setNetwork: (network: Network) => set({ network }),
        resetState: () => set({ ...initialState }),
    }))

export const initNetworkStore = () => {
    const realStore = createNetworkStore()
    lazy.init(realStore, () => realStore.getState().resetState())
}

export const clearNetworkStore = () => lazy.clear()
