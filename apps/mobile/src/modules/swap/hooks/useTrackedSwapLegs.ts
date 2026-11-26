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
import type { TransactionSwapLeg } from '@perawallet/wallet-core-chain-contract'
import { useSwapTrackingStore } from '@perawallet/wallet-core-swaps'
import { swapLegRoleOf } from '@perawallet/wallet-core-transactions'

/**
 * Each tracked order's transactions as swap legs, keyed by lowercase hash. The
 * router knows a payout's hash before the history backend links it to the order.
 */
export const useTrackedSwapLegs = (): ReadonlyMap<
    string,
    TransactionSwapLeg
> => {
    const orders = useSwapTrackingStore(state => state.orders)
    return useMemo(
        () =>
            new Map(
                Object.values(orders).flatMap(({ orderId, transactions }) =>
                    (transactions ?? []).flatMap(({ txHash, role }) => {
                        const legRole = swapLegRoleOf(role)
                        return legRole
                            ? [
                                  [
                                      txHash.toLowerCase(),
                                      { orderId, role: legRole },
                                  ] as const,
                              ]
                            : []
                    }),
                ),
            ),
        [orders],
    )
}
