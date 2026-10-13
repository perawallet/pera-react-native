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

import type { QueryClient } from '@tanstack/react-query'
import {
    isAccountBalancesHistoryQuery,
    isAccountQuery,
} from '@perawallet/wallet-core-accounts'
import {
    isAssetPriceHistoryQuery,
    isAssetQuery,
} from '@perawallet/wallet-core-assets'
import {
    queryKeyReferencesScope,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { isTransactionQuery } from '@perawallet/wallet-core-transactions'

/**
 * Drops a departed network's DB-backed cache entries instead of letting the
 * 1-hour default gcTime retain them. On a 10k-asset wallet each holdings-shaped
 * entry is a multi-MB hydrated array, so a few switches ratchet the heap until
 * GC pauses dominate the JS thread. SQLite is the source of truth
 * for all of these — a re-read on switch-back is cheap. The persisted chart
 * histories (network-only, no SQLite backing) are deliberately kept.
 */
export const releaseNetworkScopedQueries = (
    queryClient: QueryClient,
    scope: ChainScope,
): void => {
    queryClient.removeQueries({
        predicate: query => {
            const key = query.queryKey
            if (
                isAccountBalancesHistoryQuery(key) ||
                isAssetPriceHistoryQuery(key)
            ) {
                return false
            }
            if (
                !isAccountQuery(key) &&
                !isAssetQuery(key) &&
                !isTransactionQuery(key)
            ) {
                return false
            }
            return queryKeyReferencesScope(key, scope)
        },
    })
}
