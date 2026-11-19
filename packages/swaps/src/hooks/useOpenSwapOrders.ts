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

import { useMemo } from 'react'
import { isSameAddress, useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type {
    SwapAccountAddress,
    SwapStatus,
    SwapTrackedOrder,
} from '../models'
import { useSwapTrackingStore } from '../store'
import { isSwapPayerInWallet } from '../utils/isSwapPayerInWallet'
import { isSwapOrderSettled } from '../utils/swapOrderSettlement'

// Expired and cancelled orders stay unsettled while the provider can still
// overturn them, but nothing is on its way then, so they aren't open.
const IN_FLIGHT_STATUSES: ReadonlySet<SwapStatus> = new Set([
    'pending',
    'in_progress',
])

/**
 * Tracked orders still in flight where one of `accountAddresses`
 * pays or receives, newest first, leaving out any whose payer left the wallet. With `shownScope`, only orders with a side
 * on that network.
 */
export const useOpenSwapOrders = (
    accountAddresses: SwapAccountAddress[],
    shownScope: Nullable<ChainScope>,
): SwapTrackedOrder[] => {
    const orders = useSwapTrackingStore(s => s.orders)
    const walletAccounts = useAllAccounts()

    return useMemo(() => {
        const isOwn = (scope: ChainScope, address: string) =>
            accountAddresses.some(
                entry =>
                    toScopeKey(entry.scope) === toScopeKey(scope) &&
                    isSameAddress(scope.chainId, entry.address, address),
            )
        const shownKey = shownScope && toScopeKey(shownScope)
        const isShown = (order: SwapTrackedOrder) =>
            shownKey === null ||
            toScopeKey(order.sourceScope) === shownKey ||
            toScopeKey(order.destinationScope) === shownKey
        const now = Date.now()
        return Object.values(orders)
            .filter(
                order =>
                    IN_FLIGHT_STATUSES.has(order.status) &&
                    !isSwapOrderSettled(order, now) &&
                    isSwapPayerInWallet(order, walletAccounts) &&
                    isShown(order) &&
                    (isOwn(order.sourceScope, order.sourceAddress) ||
                        isOwn(
                            order.destinationScope,
                            order.destinationAddress,
                        )),
            )
            .sort((a, b) => b.createdAt - a.createdAt)
    }, [orders, walletAccounts, accountAddresses, shownScope])
}
