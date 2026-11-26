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
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useSwapTrackingStore } from '@perawallet/wallet-core-swaps'

export type SwapOrdersPaidFrom = {
    /** The network the orders were paid from. */
    scope: ChainScope
    orderIds: ReadonlySet<string>
}

/**
 * Tracked cross-chain orders paying out on `scope`, grouped by the network
 * that paid them, so a History narrowed to `scope` can list each swap's own
 * row from there. Empty for a null scope.
 */
export const useSwapOrdersPaidInto = (
    scope: Nullable<ChainScope>,
): SwapOrdersPaidFrom[] => {
    const orders = useSwapTrackingStore(state => state.orders)
    return useMemo(() => {
        if (!scope) return []
        const shownKey = toScopeKey(scope)
        const bySource = new Map<
            string,
            { scope: ChainScope; orderIds: Set<string> }
        >()
        for (const order of Object.values(orders)) {
            const sourceKey = toScopeKey(order.sourceScope)
            if (
                toScopeKey(order.destinationScope) !== shownKey ||
                sourceKey === shownKey
            ) {
                continue
            }
            const entry = bySource.get(sourceKey) ?? {
                scope: order.sourceScope,
                orderIds: new Set(),
            }
            entry.orderIds.add(order.orderId)
            bySource.set(sourceKey, entry)
        }
        return [...bySource.values()]
    }, [orders, scope])
}
