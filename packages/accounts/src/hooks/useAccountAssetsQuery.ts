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
import type { AssetSortMode } from '@perawallet/wallet-core-assets'
import {
    getAccountHoldingsLite,
    type AccountHoldingSource,
    type AccountHoldingsFilters,
    type AccountHoldingsLiteRow,
} from '../db'
import { ensureAccountFetched } from '../sync/account-syncer'
import { HOLDINGS_ROWS_GC_TIME_MS } from '../constants'
import { getAccountHoldingsPageQueryKey } from './querykeys'

export type UseAccountAssetsQueryParams = {
    filters?: AccountHoldingsFilters
    sortMode?: AssetSortMode
    search?: string
    enabled?: boolean
}

export type UseAccountAssetsQueryResult = {
    holdings: AccountHoldingsLiteRow[]
    isPending: boolean
    /** True while the rows on screen are still the previous request's. */
    isPlaceholderData: boolean
    isRefetching: boolean
    isError: boolean
    isPaused: boolean
}

const sourcesSignature = (sources: readonly unknown[]): string =>
    JSON.stringify(sources)

// The source elements sit between the two-element prefix and the params
// element; see `getAccountHoldingsPageQueryKey`.
const sourcesOfKey = (queryKey: readonly unknown[]): unknown[] =>
    queryKey.slice(2, -1)

/**
 * An account's asset list over one or more sources: sorted, filtered and
 * searched **in SQL**, read in one pass. Returns lightweight rows that defer
 * `PeraAsset` materialization (metadata parsing) to the visible rows — so a
 * re-read of thousands of holdings on every sync invalidation doesn't parse +
 * build objects for every row on the JS thread (the burst that blanked the
 * list during a large account's warm-up). FlashList virtualizes rendering, so
 * there's no need to page the data; one stable read avoids the scroll jumps
 * that paging over a value sort caused as prices/metadata enriched.
 */
export const useAccountAssetsQuery = (
    sources: readonly AccountHoldingSource[],
    {
        filters,
        sortMode = 'balanceDesc',
        search,
        enabled = true,
    }: UseAccountAssetsQueryParams = {},
): UseAccountAssetsQueryResult => {
    const queryKey = getAccountHoldingsPageQueryKey(sources, {
        filters,
        sortMode,
        search,
    })
    const signature = sourcesSignature(sourcesOfKey(queryKey))
    const isEnabled = sources.length > 0 && enabled

    const query = useQuery({
        queryKey,
        enabled: isEnabled,
        staleTime: Infinity,
        gcTime: HOLDINGS_ROWS_GC_TIME_MS,
        // Same reason as the collectibles read: sort mode, filters
        // and search are part of the key, so changing one starts a cold query
        // that would empty the list mid-interaction. Hold the previous rows,
        // but never across accounts, networks or a different set of chains.
        placeholderData: (previousRows, previousQuery) =>
            previousQuery &&
            sourcesSignature(sourcesOfKey(previousQuery.queryKey)) === signature
                ? previousRows
                : undefined,
        // SQLite is the source of truth; run the queryFn even while offline
        // instead of pausing it (TanStack's default networkMode: 'online'),
        // which would strand consumers in `pending`. Network segments are
        // already caught in the syncer.
        networkMode: 'always',
        queryFn: async () => {
            // Self-heal a freshly imported/selected account the background sync
            // hasn't populated yet (deduped with the summary query's fetch).
            await Promise.all(
                sources.map(({ address, scope }) =>
                    ensureAccountFetched(address, scope),
                ),
            )
            return getAccountHoldingsLite({
                sources,
                ...filters,
                sortMode,
                search,
            })
        },
    })

    return {
        holdings: query.data ?? [],
        isPending: isEnabled && query.isPending,
        isPlaceholderData: query.isPlaceholderData,
        isRefetching: query.isRefetching,
        isError: query.isError,
        isPaused: query.isPaused,
    }
}
