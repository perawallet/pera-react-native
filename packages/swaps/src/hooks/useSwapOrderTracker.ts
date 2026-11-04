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

import { useEffect } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { invalidateAccountQueriesForAddresses } from '@perawallet/wallet-core-accounts'
import { fetchSwapOrder } from '../api'
import type { SwapStatus, SwapTrackedOrder } from '../models'
import { useSwapTrackingStore } from '../store'
import { isSwapOrderSettled } from '../utils/swapOrderSettlement'
import { getInvalidateSwapHistoryPredicate, swapQueryKeys } from './querykeys'

const POLL_INTERVAL_MS = 30_000

const addressRefreshedOn = (
    order: SwapTrackedOrder,
    status: SwapStatus,
): string | null => {
    if (status === 'completed') return order.destinationAddress
    if (status === 'refunded') return order.sourceAddress
    return null
}

/**
 * Follows every tracked cross-chain order until the router settles it. Mounted
 * once, app-wide, so orders restored from storage after a relaunch resume.
 * Each order is read on the scope it was placed on, not the selected network.
 */
export const useSwapOrderTracker = (): void => {
    const queryClient = useQueryClient()
    const orders = useSwapTrackingStore(s => s.orders)
    const updateOrderStatus = useSwapTrackingStore(s => s.updateOrderStatus)
    const pruneSettledOrders = useSwapTrackingStore(s => s.pruneSettledOrders)

    useEffect(() => {
        pruneSettledOrders(Date.now())
    }, [pruneSettledOrders])

    const open = Object.values(orders).filter(
        order => !isSwapOrderSettled(order, Date.now()),
    )

    // Read during render: TanStack re-renders only for fields read there.
    const statuses = useQueries({
        queries: open.map(order => ({
            queryKey: swapQueryKeys.order(order.orderId, order.sourceScope),
            queryFn: () => fetchSwapOrder(order.orderId, order.sourceScope),
            refetchInterval: POLL_INTERVAL_MS,
            staleTime: 0,
        })),
    }).map(result => result.data?.status)

    useEffect(() => {
        open.forEach((order, index) => {
            const status = statuses[index]
            if (!status || status === order.status) return
            updateOrderStatus(order.orderId, status, Date.now())
            const address = addressRefreshedOn(order, status)
            if (!address) return
            invalidateAccountQueriesForAddresses(queryClient, [address], {
                includeMultiAccountKeys: true,
            })
            void queryClient.invalidateQueries({
                predicate: getInvalidateSwapHistoryPredicate,
            })
        })
    })
}
