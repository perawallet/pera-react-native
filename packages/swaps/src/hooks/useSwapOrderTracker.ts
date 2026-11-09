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
import {
    addressOn,
    fetchAndPersistAccount,
    invalidateAccountQueriesForAddresses,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { fetchSwapOrder } from '../api'
import type { SwapStatus, SwapTrackedOrder } from '../models'
import { useSwapTrackingStore } from '../store'
import { isSwapOrderSettled } from '../utils/swapOrderSettlement'
import { getInvalidateSwapHistoryPredicate, swapQueryKeys } from './querykeys'

const POLL_INTERVAL_MS = 30_000

const accountRefreshedOn = (
    order: SwapTrackedOrder,
    status: SwapStatus,
): Nullable<{ address: string; scope: ChainScope }> => {
    if (status === 'completed') {
        return {
            address: order.destinationAddress,
            scope: order.destinationScope,
        }
    }
    if (status === 'refunded') {
        return { address: order.sourceAddress, scope: order.sourceScope }
    }
    return null
}

/**
 * Follows every tracked cross-chain order until the router settles it. Mounted
 * once, app-wide, so orders restored from storage after a relaunch resume.
 * Each order is read on the scope it was placed on, not the selected network.
 * An order whose paying account left the wallet is skipped rather than dropped,
 * so it resumes if that account is imported again; the tracking limit ends it.
 */
export const useSwapOrderTracker = (): void => {
    const queryClient = useQueryClient()
    const accounts = useAllAccounts()
    const orders = useSwapTrackingStore(s => s.orders)
    const updateOrderStatus = useSwapTrackingStore(s => s.updateOrderStatus)
    const pruneSettledOrders = useSwapTrackingStore(s => s.pruneSettledOrders)

    useEffect(() => {
        pruneSettledOrders(Date.now())
    }, [pruneSettledOrders])

    const open = Object.values(orders).filter(
        order =>
            !isSwapOrderSettled(order, Date.now()) &&
            accounts.some(
                account =>
                    addressOn(account, order.sourceScope) ===
                    order.sourceAddress,
            ),
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
            const account = accountRefreshedOn(order, status)
            if (!account) return
            const { address, scope } = account
            // The payout is someone else's transfer, which the change signal
            // doesn't flag, so the account is read now rather than at the next scan.
            void fetchAndPersistAccount(address, scope)
                .catch((error: unknown) => {
                    logger.warn('Account read after a settled swap failed', {
                        scope,
                        error,
                    })
                })
                .then(() => {
                    invalidateAccountQueriesForAddresses(
                        queryClient,
                        [address],
                        { includeMultiAccountKeys: true },
                    )
                })
            void queryClient.invalidateQueries({
                predicate: getInvalidateSwapHistoryPredicate,
            })
        })
    })
}
