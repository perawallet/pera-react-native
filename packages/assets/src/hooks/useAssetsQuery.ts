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
import { useQuery } from '@tanstack/react-query'
import { type PeraAsset } from '../models'
import { getAssetsQueryKey } from './querykeys'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getAssetsByIds } from '../db'

type UseAssetsQueryResult = {
    data: Map<string, PeraAsset>
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

export const useAssetsQuery = (ids: string[]): UseAssetsQueryResult => {
    const { network } = useNetwork()

    // Keep a stable reference to ids — only update when the actual content changes.
    // This prevents query recomputation when callers pass a new array with the same values.
    const idsKey = ids.join(',')
    const idsRef = useRef({ ids, key: idsKey })
    if (idsKey !== idsRef.current.key) {
        idsRef.current = { ids, key: idsKey }
    }
    const stableIds = idsRef.current.ids

    const query = useQuery({
        queryKey: getAssetsQueryKey(stableIds, network),
        staleTime: Infinity,
        // No ids → nothing to fetch. Skip the query entirely so callers that
        // already supply the asset (e.g. the asset-list rows pass skipFetch and
        // get an empty id list) don't mount a live observer per row.
        enabled: stableIds.length > 0,
        queryFn: () => getAssetsByIds({ assetIds: stableIds, network }),
    })

    return useMemo(() => {
        const assets: Map<string, PeraAsset> = new Map()

        query.data?.forEach(asset => {
            assets.set(asset.assetId, asset)
        })

        return {
            data: assets,
            isPending: query.isPending,
            isFetched: query.isFetched,
            isRefetching: query.isRefetching,
            isError: query.isError,
        }
    }, [
        stableIds,
        query.data,
        query.isPending,
        query.isFetched,
        query.isRefetching,
        query.isError,
    ])
}
