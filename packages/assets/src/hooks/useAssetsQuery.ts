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
import { useQuery } from '@tanstack/react-query'
import type { PeraAsset } from '../models'
import { getAssetsQueryKey } from './querykeys'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useStableIdList } from '@perawallet/wallet-core-shared'
import { getAssetsByIds } from '../db'
import { fetchAndPersistAssets } from '../sync/asset-syncer'

type UseAssetsQueryResult = {
    data: Map<string, PeraAsset>
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

type UseAssetsQueryOptions = {
    /**
     * Fetch+persist any ids missing from (or stale in) the local DB before
     * reading. Off by default: most callers only care about assets the user
     * already holds, which are already synced. Turn it on for flows that
     * surface arbitrary assets the user may not hold — e.g. signing a
     * transaction involving an asset that isn't in the wallet yet — so they
     * resolve to real names/units instead of falling back to the raw id.
     */
    fetchMissing?: boolean
}

export const useAssetsQuery = (
    ids: string[],
    { fetchMissing = false }: UseAssetsQueryOptions = {},
): UseAssetsQueryResult => {
    const { network } = useNetwork()

    // Keep a stable reference to ids — only update when the actual content
    // changes. This prevents query recomputation when callers pass a new array
    // with the same values.
    const stableIds = useStableIdList(ids)

    const query = useQuery({
        // fetchMissing reads through the network, so it gets its own cache
        // entry — a DB-only caller must never satisfy it from cache (with
        // staleTime Infinity that would strand the missing assets).
        queryKey: fetchMissing
            ? [...getAssetsQueryKey(stableIds, network), { fetchMissing: true }]
            : getAssetsQueryKey(stableIds, network),
        staleTime: Infinity,
        // No ids → nothing to fetch. Skip the query entirely so callers that
        // already supply the asset (e.g. the asset-list rows pass skipFetch and
        // get an empty id list) don't mount a live observer per row.
        enabled: stableIds.length > 0,
        queryFn: async () => {
            if (fetchMissing) {
                await fetchAndPersistAssets(stableIds, network)
            }
            return getAssetsByIds({ assetIds: stableIds, network })
        },
    })

    // Derive the Map from query.data alone so its identity (and the assets it
    // holds) stays stable when only a status flag flips — e.g. isRefetching
    // during a background refetch. Consumers that dep on an asset in an effect
    // then don't re-run on every status transition.
    const data = useMemo(() => {
        const assets: Map<string, PeraAsset> = new Map()

        query.data?.forEach(asset => {
            assets.set(asset.assetId, asset)
        })

        return assets
    }, [query.data])

    return useMemo(
        () => ({
            data,
            isPending: query.isPending,
            isFetched: query.isFetched,
            isRefetching: query.isRefetching,
            isError: query.isError,
        }),
        [
            data,
            query.isPending,
            query.isFetched,
            query.isRefetching,
            query.isError,
        ],
    )
}
