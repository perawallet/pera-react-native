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
import {
    guardedPersist,
    registerStore,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { SwapTrackedOrder, SwapTrackingState } from '../models'
import {
    isSwapOrderSettled,
    SWAP_STATUS_REVERSIBLE_MS,
} from '../utils/swapOrderSettlement'

const STORE_NAME = 'swap-tracking-store'

const initialState = {
    orders: {} as Record<string, SwapTrackedOrder>,
}

/**
 * Cross-chain orders the router is still settling. Persisted so an order in
 * flight when the app is killed is picked up again on the next launch.
 */
export const useSwapTrackingStore: UseBoundStore<
    WithPersist<StoreApi<SwapTrackingState>, unknown>
> = create<SwapTrackingState>()(
    guardedPersist(
        set => ({
            ...initialState,
            trackOrder: (order: SwapTrackedOrder) =>
                set(state => ({
                    orders: { ...state.orders, [order.orderId]: order },
                })),
            updateOrderStatus: (orderId, status, checkedAt) =>
                set(state => {
                    const order = state.orders[orderId]
                    if (!order) return state
                    return {
                        orders: {
                            ...state.orders,
                            [orderId]: { ...order, status, checkedAt },
                        },
                    }
                }),
            removeOrder: (orderId: string) =>
                set(state => {
                    if (!state.orders[orderId]) return state
                    const { [orderId]: _removed, ...rest } = state.orders
                    return { orders: rest }
                }),
            pruneSettledOrders: (now: number) =>
                set(state => ({
                    orders: Object.fromEntries(
                        Object.entries(state.orders).filter(
                            ([, order]) =>
                                !isSwapOrderSettled(order, now) ||
                                now - order.createdAt <
                                    SWAP_STATUS_REVERSIBLE_MS,
                        ),
                    ),
                })),
            resetState: () => set({ ...initialState }),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            version: 1,
            partialize: state => ({ orders: state.orders }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useSwapTrackingStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSwapTrackingStore.getState().resetState(),
})
