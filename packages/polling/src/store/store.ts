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
    registerStore,
    type Network,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { LastRefreshedRounds, PollingState } from '../models'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'polling-store'

const initialState = {
    lastRefreshedRound: {
        mainnet: null,
        testnet: null,
    } as LastRefreshedRounds,
}

export const usePollingStore: UseBoundStore<
    WithPersist<StoreApi<PollingState>, unknown>
> = create<PollingState>()(
    persist(
        set => ({
            ...initialState,
            setLastRefreshedRound: (
                network: Network,
                round: Nullable<number>,
            ) => {
                set(state => ({
                    lastRefreshedRound: {
                        ...state.lastRefreshedRound,
                        [network]: round,
                    },
                }))
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            partialize: state => ({
                lastRefreshedRound: state.lastRefreshedRound,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            usePollingStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => usePollingStore.getState().resetState(),
})
