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
import type { AssetPrices } from '../models'
import { getAssetPricesQueryKey } from './querykeys'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useStableIdList } from '@perawallet/wallet-core-shared'
import { getAssetPricesByIds } from '../db'

type UseAssetPricesQueryResult = {
    data: AssetPrices
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
    isPaused: boolean
}

export const useAssetPricesQuery = (
    ids: string[],
    enabled?: boolean,
): UseAssetPricesQueryResult => {
    const { network } = useNetwork()

    // Keep a stable reference to ids — only update when the actual content
    // changes. This prevents query recomputation when callers pass a new array
    // with the same values.
    const stableIds = useStableIdList(ids)

    const query = useQuery({
        queryKey: getAssetPricesQueryKey(stableIds, network),
        enabled: enabled ?? true,
        staleTime: Infinity,
        queryFn: () => getAssetPricesByIds({ assetIds: stableIds, network }),
        // SQLite is the source of truth; run the queryFn even while offline instead
        // of pausing it (TanStack's default networkMode: 'online'), which would strand
        // consumers in `pending`.
        networkMode: 'always',
    })

    return useMemo(() => {
        const assetPrices: AssetPrices = new Map()
        query.data?.forEach(row => {
            assetPrices.set(row.assetId, {
                assetId: row.assetId,
                usdPrice: row.usdPrice,
            })
        })
        return {
            data: assetPrices,
            isPending: query.isPending,
            isFetched: query.isFetched,
            isRefetching: query.isRefetching,
            isError: query.isError,
            isPaused: query.isPaused,
        }
    }, [
        query.data,
        query.isPending,
        query.isFetched,
        query.isRefetching,
        query.isError,
        query.isPaused,
    ])
}
