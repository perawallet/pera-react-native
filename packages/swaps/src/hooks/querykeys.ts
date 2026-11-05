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

import type { Query } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { SwapAccountAddress, SwapAssetRef, SwapStatus } from '../models'

const MODULE_PREFIX = 'swaps'

export const swapQueryKeys = {
    pairs: (
        anchor: Nullable<SwapAssetRef>,
        q: Optional<string>,
        scope: ChainScope,
        destinationScopes: ChainScope[] = [scope],
    ) =>
        [
            MODULE_PREFIX,
            'pairs',
            { anchor, q, scope, destinationScopes },
        ] as const,
    // The first account's scope rides at the top level so scope-wide
    // invalidation still finds the key.
    historyInfinite: (
        accounts: SwapAccountAddress[],
        statuses?: SwapStatus[],
    ) =>
        [
            MODULE_PREFIX,
            'history-infinite',
            { accounts, scope: accounts.at(0)?.scope ?? null, statuses },
        ] as const,
    order: (orderId: string, scope: ChainScope) =>
        [MODULE_PREFIX, 'order', { orderId, scope }] as const,
    sourceCost: (quoteId: string, scope: ChainScope) =>
        [MODULE_PREFIX, 'source-cost', { quoteId, scope }] as const,
    distinctPairsHistory: (address: string, scope: ChainScope) =>
        [MODULE_PREFIX, 'distinct-pairs-history', { address, scope }] as const,
}

/**
 * What a completed swap can change: the caller's own history, both the "see
 * all" list and the distinct-pair chips. Matched on the leading segments so
 * every cached address and scope refreshes at once. Pairs are left alone: a
 * swap doesn't move them.
 */
const INVALIDATED_ON_SWAP = ['history-infinite', 'distinct-pairs-history']

export const getInvalidateSwapHistoryPredicate = (query: Query) =>
    query.queryKey.length >= 2 &&
    query.queryKey.at(0) === MODULE_PREFIX &&
    INVALIDATED_ON_SWAP.includes(query.queryKey.at(1) as string)
