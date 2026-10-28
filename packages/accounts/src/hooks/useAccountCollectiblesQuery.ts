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

import { useQuery } from '@tanstack/react-query'
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import {
    getAccountCollectiblesLite,
    type AccountCollectibleLiteRow,
    type AccountHoldingSource,
    type CollectibleSqlSortMode,
} from '../db'
import { ensureAccountFetched } from '../sync/account-syncer'
import { HOLDINGS_ROWS_GC_TIME_MS } from '../constants'
import { useHoldingsRefreshStore } from '../store/holdingsRefresh'
import { getAccountCollectiblesQueryKey } from './querykeys'

export type UseAccountCollectiblesQueryParams = {
    /** Omit to order by asset id descending, for callers that re-sort. */
    sortMode?: CollectibleSqlSortMode
    search?: string
    /** When false, collectibles the account holds none of are excluded. */
    includeZeroBalance?: boolean
    enabled?: boolean
}

export type UseAccountCollectiblesQueryResult = {
    collectibles: AccountCollectibleLiteRow[]
    isPending: boolean
    /** True while the rows on screen are still the previous request's. */
    isPlaceholderData: boolean
    isRefetching: boolean
    isError: boolean
    isPaused: boolean
    /** True while any source's last sync left some of its holdings unrefreshed. */
    hasUnrefreshedHoldings: boolean
}

const sourcesSignature = (sources: readonly unknown[]): string =>
    JSON.stringify(sources)

// The source elements sit between the two-element prefix and the params
// element; see `getAccountCollectiblesQueryKey`.
const sourcesOfKey = (queryKey: readonly unknown[]): unknown[] =>
    queryKey.slice(2, -1)

/**
 * An account's collectibles over one or more sources, filtered/searched/sorted **in SQL**, read in one
 * pass and returned as lite rows that defer `PeraAsset` materialization to the
 * rows actually on screen.
 *
 * Reading every holding, handing all of their ids back as a huge `IN (…)`
 * list, and parsing every metadata blob on the JS thread before telling a
 * collectible from a token would delay first paint on a large account,
 * repeatedly, on every sync invalidation. Same shape as
 * {@link useAccountAssetsQuery}, which takes the same approach for the fungible list.
 */
export const useAccountCollectiblesQuery = (
    sources: readonly AccountHoldingSource[],
    {
        sortMode,
        search,
        includeZeroBalance = true,
        enabled = true,
    }: UseAccountCollectiblesQueryParams = {},
): UseAccountCollectiblesQueryResult => {
    const queryKey = getAccountCollectiblesQueryKey(sources, {
        sortMode,
        search,
        includeZeroBalance,
    })
    const signature = sourcesSignature(sourcesOfKey(queryKey))

    const query = useQuery({
        queryKey,
        enabled: sources.length > 0 && enabled,
        staleTime: Infinity,
        gcTime: HOLDINGS_ROWS_GC_TIME_MS,
        // Sort mode and search term are part of the key, so changing either
        // starts a cold query that would blank the gallery until SQL answers —
        // on a large, freshly imported account that read as "sorting does
        // nothing". Hold the rows already on screen instead, but never across
        // accounts, networks or a different set of chains.
        placeholderData: (previousRows, previousQuery) =>
            previousQuery &&
            sourcesSignature(sourcesOfKey(previousQuery.queryKey)) === signature
                ? previousRows
                : undefined,
        // SQLite is the source of truth; run the queryFn even while offline
        // instead of pausing it (TanStack's default networkMode: 'online'),
        // which would strand consumers in `pending`.
        networkMode: 'always',
        queryFn: async () => {
            // Self-heal a freshly imported/selected account the background sync
            // hasn't populated yet (deduped with the summary query's fetch).
            await Promise.all(
                sources.map(({ address, scope }) =>
                    ensureAccountFetched(address, scope),
                ),
            )
            return getAccountCollectiblesLite({
                sources,
                sortMode,
                search,
                includeZeroBalance,
            })
        },
    })

    const hasUnrefreshedHoldings = useHoldingsRefreshStore(state =>
        sources.some(
            ({ address, scope }) =>
                state.failed[toScopeKey(scope)]?.[address] === true,
        ),
    )

    return {
        collectibles: query.data ?? [],
        isPending: query.isPending,
        isPlaceholderData: query.isPlaceholderData,
        isRefetching: query.isRefetching,
        isError: query.isError,
        isPaused: query.isPaused,
        hasUnrefreshedHoldings,
    }
}
