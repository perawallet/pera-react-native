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

import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { SwapHistoryItem, SwapStatus } from '../models'

export interface SwapPayoutRef {
    scope: ChainScope
    /** Absent while the order is in flight and the router hasn't listed the payout yet. */
    transactionId: Optional<string>
}

const IN_FLIGHT: ReadonlySet<SwapStatus> = new Set(['pending', 'in_progress'])

/**
 * A cross-chain swap's payout on its receive chain. Undefined for a same-chain
 * swap, and for a settled order that never paid out (failed, refunded).
 */
export const swapPayoutOf = (
    item: SwapHistoryItem,
): Optional<SwapPayoutRef> => {
    if (!item.assetIn || !item.assetOut) return undefined
    const scope: ChainScope = {
        chainId: item.assetOut.ref.chainId,
        networkId: item.assetOut.ref.networkId,
    }
    const receiveScopeKey = toScopeKey(scope)
    if (toScopeKey(item.assetIn.ref) === receiveScopeKey) return undefined

    const payout = item.transactions.find(
        transaction =>
            transaction.role === 'payout' &&
            transaction.scope !== null &&
            toScopeKey(transaction.scope) === receiveScopeKey,
    )
    if (payout) return { scope, transactionId: payout.txHash }
    return IN_FLIGHT.has(item.status)
        ? { scope, transactionId: undefined }
        : undefined
}
