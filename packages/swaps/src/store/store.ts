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
import type { SwapsState } from '../models'
import {
    registerStore,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'swaps-store'

// TODO: Replace with ALGO_ASSET_ID and KNOWN_ASSET_IDS.USDC from @perawallet/wallet-core-assets
// once the assets barrel (which re-exports hooks) no longer causes Metro evaluation order issues
const initialState = {
    fromAsset: '0', // ALGO
    toAsset: '31566704', // USDC mainnet
    slippage: null as Nullable<string>,
}

export const useSwapsStore: UseBoundStore<
    WithPersist<StoreApi<SwapsState>, unknown>
> = create<SwapsState>()(
    persist(
        set => ({
            ...initialState,
            setFromAsset: (fromAsset: string) => set({ fromAsset }),
            setToAsset: (toAsset: string) => set({ toAsset }),
            setSlippage: (slippage: Nullable<string>) => set({ slippage }),
            resetState: () =>
                set(state => ({
                    ...initialState,
                    slippage: state.slippage,
                })),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 3,
            migrate: (persisted, version) => {
                if (version < 2) {
                    return {
                        ...(persisted as Partial<SwapsState>),
                        slippage: null,
                    } as SwapsState
                }
                if (version < 3) {
                    const {
                        fromAsset: _fromAsset,
                        toAsset: _toAsset,
                        ...rest
                    } = persisted as Record<string, unknown>
                    return rest as SwapsState
                }
                return persisted as SwapsState
            },
            partialize: state => ({
                slippage: state.slippage,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useSwapsStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSwapsStore.getState().resetState(),
})
