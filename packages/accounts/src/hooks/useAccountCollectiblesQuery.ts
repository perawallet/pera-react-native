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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    getAccountCollectiblesLite,
    type AccountCollectibleLiteRow,
    type CollectibleSqlSortMode,
} from '../db'
import { ensureAccountFetched } from '../sync/account-syncer'
import { getAccountCollectiblesQueryKey } from './querykeys'

export type UseAccountCollectiblesQueryParams = {
    /** Omit to order by asset id descending, for callers that re-sort. */
    sortMode?: CollectibleSqlSortMode
    search?: string
    /** When false, collectibles the account holds none of are excluded. */
    includeOptedInOnly?: boolean
    enabled?: boolean
}

export type UseAccountCollectiblesQueryResult = {
    collectibles: AccountCollectibleLiteRow[]
    isPending: boolean
    isRefetching: boolean
    isError: boolean
    isPaused: boolean
}

/**
 * An account's collectibles, filtered/searched/sorted **in SQL**, read in one
 * pass and returned as lite rows that defer `PeraAsset` materialization to the
 * rows actually on screen.
 *
 * The gallery previously read every holding, handed all of their ids back as a
 * 15k-parameter `IN (…)` list, and parsed every metadata blob on the JS thread
 * before it could tell a collectible from a token — double-digit seconds to
 * first paint on a large account, repeated on every sync invalidation. Same
 * shape as {@link useAccountAssetsQuery}, which fixed the fungible list.
 */
export const useAccountCollectiblesQuery = (
    address: string | undefined,
    {
        sortMode,
        search,
        includeOptedInOnly = true,
        enabled = true,
    }: UseAccountCollectiblesQueryParams = {},
): UseAccountCollectiblesQueryResult => {
    const { network } = useNetwork()

    const query = useQuery({
        queryKey: getAccountCollectiblesQueryKey(address ?? '', network, {
            sortMode,
            search,
            includeOptedInOnly,
        }),
        enabled: !!address && enabled,
        staleTime: Infinity,
        // SQLite is the source of truth; run the queryFn even while offline
        // instead of pausing it (TanStack's default networkMode: 'online'),
        // which would strand consumers in `pending`.
        networkMode: 'always',
        queryFn: async () => {
            // Self-heal a freshly imported/selected account the background sync
            // hasn't populated yet (deduped with the summary query's fetch).
            await ensureAccountFetched(address as string, network)
            return getAccountCollectiblesLite({
                accountAddress: address as string,
                network,
                sortMode,
                search,
                includeOptedInOnly,
            })
        },
    })

    return {
        collectibles: query.data ?? [],
        isPending: query.isPending,
        isRefetching: query.isRefetching,
        isError: query.isError,
        isPaused: query.isPaused,
    }
}
