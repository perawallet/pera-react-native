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

import { useMemo, useRef } from 'react'
import { useQueries } from '@tanstack/react-query'
import { ALGO_ASSET_ID, type AssetPrices } from '../models'
import {
    fetchAssetPrices,
    fetchPublicAssetDetails,
    transformAssetPriceResponse,
} from '../api'
import type { AssetPriceResponse } from '../api'
import { DEFAULT_PAGE_SIZE, partition } from '@perawallet/wallet-core-shared'
import { getAssetPricesQueryKey } from './querykeys'
import { PublicAssetResponse } from '../api/assets/schema'
import { useNetwork } from '@perawallet/wallet-core-blockchain'

type UseAssetPricesQueryResult = {
    data: AssetPrices
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

export const useAssetPricesQuery = (
    ids: string[],
    enabled?: boolean,
): UseAssetPricesQueryResult => {
    const { network } = useNetwork()

    // Keep a stable reference to ids — only update when the actual content changes.
    // This prevents query recomputation when callers pass a new array with the same values.
    const idsKey = ids.join(',')
    const idsRef = useRef({ ids, key: idsKey })
    if (idsKey !== idsRef.current.key) {
        idsRef.current = { ids, key: idsKey }
    }
    const stableIds = idsRef.current.ids

    const queriesDefinitions = useMemo(() => {
        const chunks = partition(
            stableIds.filter(id => id !== ALGO_ASSET_ID),
            DEFAULT_PAGE_SIZE,
        )

        return [
            ...chunks.map(chunk => ({
                queryKey: getAssetPricesQueryKey(chunk, network),
                enabled: enabled ?? true,
                queryFn: async () => fetchAssetPrices(chunk, network),
                select: (data: { results: AssetPriceResponse[] }) => ({
                    results: data.results.map(asset => ({
                        asset_id: `${asset.asset_id}`,
                        usd_value: asset.usd_value,
                    })),
                }),
            })),
            {
                queryKey: getAssetPricesQueryKey([ALGO_ASSET_ID], network),
                enabled: enabled ?? true,
                queryFn: async () =>
                    fetchPublicAssetDetails(ALGO_ASSET_ID, network),
                select: (data: PublicAssetResponse) => ({
                    results: [
                        {
                            asset_id: ALGO_ASSET_ID,
                            usd_value: data.usd_value ?? '0',
                        },
                    ],
                }),
            },
        ]
    }, [stableIds, enabled, network])

    // notifyOnChangeProps: 'all' disables Proxy-based property tracking in TanStack Query.
    // This works around a race condition in QueriesObserver where _observerMatches and _result
    // can get out of sync during synchronous notifications, causing "new Proxy target must be an Object".
    const queries = useQueries({
        queries: queriesDefinitions.map(q => ({
            ...q,
            notifyOnChangeProps: 'all' as const,
        })),
    })

    return useMemo(() => {
        const assetPrices: AssetPrices = new Map()
        queries.forEach(query => {
            query.data?.results?.forEach((asset: AssetPriceResponse) => {
                const assetPrice = transformAssetPriceResponse(asset)
                assetPrices.set(asset.asset_id.toString(), assetPrice)
            })
        })
        return {
            data: assetPrices,
            isPending: queries.some(query => query.isPending),
            isFetched: queries.some(query => query.isFetched),
            isRefetching: queries.some(query => query.isRefetching),
            isError: queries.some(query => query.isError),
        }
    }, [queries])
}
