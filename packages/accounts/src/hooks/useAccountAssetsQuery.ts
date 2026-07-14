/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { type AssetSortMode } from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    getAccountHoldingsLite,
    type AccountHoldingsFilters,
    type AccountHoldingsLiteRow,
} from '../db'
import { ensureAccountFetched } from '../sync/account-syncer'
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
    isRefetching: boolean
    isError: boolean
    isPaused: boolean
}

/**
 * A single account's asset list: sorted, filtered and searched **in SQL**, read
 * in one pass. Returns lightweight rows that defer `PeraAsset` materialization
 * (metadata parsing) to the visible rows — so a re-read of thousands of
 * holdings on every sync invalidation doesn't parse + build objects for every
 * row on the JS thread (the burst that blanked the list during a large
 * account's warm-up). FlashList virtualizes rendering, so there's no need to
 * page the data; one stable read avoids the scroll jumps that paging over a
 * value sort caused as prices/metadata enriched.
 */
export const useAccountAssetsQuery = (
    address: string | undefined,
    {
        filters,
        sortMode = 'balanceDesc',
        search,
        enabled = true,
    }: UseAccountAssetsQueryParams = {},
): UseAccountAssetsQueryResult => {
    const { network } = useNetwork()

    const query = useQuery({
        queryKey: getAccountHoldingsPageQueryKey(address ?? '', network, {
            filters,
            sortMode,
            search,
        }),
        enabled: !!address && enabled,
        staleTime: Infinity,
        // SQLite is the source of truth; run the queryFn even while offline
        // instead of pausing it (TanStack's default networkMode: 'online'),
        // which would strand consumers in `pending`. Network segments are
        // already caught in the syncer.
        networkMode: 'always',
        queryFn: async () => {
            // Self-heal a freshly imported/selected account the background sync
            // hasn't populated yet (deduped with the summary query's fetch).
            await ensureAccountFetched(address as string, network)
            return getAccountHoldingsLite({
                accountAddress: address as string,
                network,
                ...filters,
                sortMode,
                search,
            })
        },
    })

    return {
        holdings: query.data ?? [],
        isPending: query.isPending,
        isRefetching: query.isRefetching,
        isError: query.isError,
        isPaused: query.isPaused,
    }
}
