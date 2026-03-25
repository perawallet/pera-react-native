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
import { type PeraAsset } from '../models'
import { DEFAULT_PAGE_SIZE, partition } from '@perawallet/wallet-core-shared'
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

    const queryDefinitions = useMemo(() => {
        const chunks = partition(stableIds, DEFAULT_PAGE_SIZE)
        return chunks.map(chunk => ({
            queryKey: getAssetsQueryKey(chunk, network),
            staleTime: Infinity,
            queryFn: () => getAssetsByIds({ assetIds: chunk, network }),
        }))
    }, [stableIds, network])

    // notifyOnChangeProps: 'all' disables Proxy-based property tracking in TanStack Query.
    // This works around a race condition in QueriesObserver where _observerMatches and _result
    // can get out of sync during synchronous notifications, causing "new Proxy target must be an Object".
    const queries = useQueries({
        queries: queryDefinitions.map(q => ({
            ...q,
            notifyOnChangeProps: 'all' as const,
        })),
    })

    const result = useMemo(() => {
        const isPending = queries.some(query => query.isPending)
        const isFetched = queries.some(query => query.isFetched)
        const assets: Map<string, PeraAsset> = new Map()

        queries.forEach(query => {
            query.data?.forEach(asset => {
                assets.set(asset.assetId, asset)
            })
        })

        return {
            data: assets,
            isPending,
            isFetched,
            isRefetching: queries.some(query => query.isRefetching),
            isError: queries.some(query => query.isError),
        }
    }, [queries])

    return result
}
