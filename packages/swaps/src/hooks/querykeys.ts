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

import { type Query } from '@tanstack/react-query'
import type { Network, Optional } from '@perawallet/wallet-core-shared'

const MODULE_PREFIX = 'swaps'

export const swapQueryKeys = {
    availableAssets: (
        assetInId: number,
        q: Optional<string>,
        network: Network,
    ) =>
        [MODULE_PREFIX, 'available-assets', { assetInId, q, network }] as const,
    historyInfinite: (
        address: string,
        statuses: Optional<string>,
        network: Network,
    ) =>
        [
            MODULE_PREFIX,
            'history-infinite',
            { address, statuses, network },
        ] as const,
    distinctPairsHistory: (
        address: string,
        statuses: Optional<string>,
        network: Network,
    ) =>
        [
            MODULE_PREFIX,
            'distinct-pairs-history',
            { address, statuses, network },
        ] as const,
    providers: (network: Network) =>
        [MODULE_PREFIX, 'providers', { network }] as const,
    topPairs: (limit: Optional<number>, network: Network) =>
        [MODULE_PREFIX, 'top-pairs', { limit, network }] as const,
}

/**
 * What a completed swap can change: the caller's own history — the "see all"
 * list and the distinct-pair chips — plus the system-wide top pairs, which rank
 * on 24h volume that this swap just contributed to. On a quiet window a single
 * account's swaps can be most of that volume, so top pairs really can go stale
 * on the strength of one trade.
 *
 * Matched on the leading segments so every cached address, status filter and
 * network refreshes at once; after a swap lands, any of them could be out of
 * date. Providers and available assets are left alone — a swap doesn't move
 * them.
 */
const INVALIDATED_ON_SWAP = [
    'history-infinite',
    'distinct-pairs-history',
    'top-pairs',
]

export const getInvalidateSwapHistoryPredicate = (query: Query) =>
    query.queryKey.length >= 2 &&
    query.queryKey.at(0) === MODULE_PREFIX &&
    INVALIDATED_ON_SWAP.includes(query.queryKey.at(1) as string)
