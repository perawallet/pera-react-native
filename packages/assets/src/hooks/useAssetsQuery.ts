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
import {
    fetchAssets,
    fetchPublicAssetDetails,
    transformAssetResponse,
    transformPublicAssetResponse,
} from '../api'
import { ALGO_ASSET_ID, type PeraAsset } from '../models'
import { DEFAULT_PAGE_SIZE, partition } from '@perawallet/wallet-core-shared'
import { getAlgoQueryKey, getAssetsQueryKey } from './querykeys'
import { AssetsResponse, PublicAssetResponse } from '../api/assets/schema'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'

type UseAssetsQueryResult = {
    data: Map<string, PeraAsset>
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

export const useAssetsQuery = (ids: string[]): UseAssetsQueryResult => {
    const { network } = useNetwork()

    const idsRef = useRef(ids)
    if (
        ids.length !== idsRef.current.length ||
        !ids.every((id, i) => id === idsRef.current[i])
    ) {
        idsRef.current = ids
    }
    const stableIds = idsRef.current

    const queryDefinitions = useMemo(() => {
        const chunks = partition(stableIds, DEFAULT_PAGE_SIZE)
        return [
            ...chunks.map(chunk => ({
                queryKey: getAssetsQueryKey(chunk, network),
                queryFn: async () => fetchAssets(chunk, network),
                select: (data: AssetsResponse) => ({
                    results: data.results.map(transformAssetResponse),
                    next: data.next,
                    previous: data.previous,
                }),
            })),
            {
                queryKey: getAlgoQueryKey(network),
                queryFn: async () =>
                    fetchPublicAssetDetails(ALGO_ASSET_ID, network),
                select: (data: PublicAssetResponse) => ({
                    results: [transformPublicAssetResponse(data)],
                    next: null,
                    previous: null,
                }),
            },
        ]
    }, [stableIds, network])

    const queries = useQueries({
        queries: queryDefinitions,
    })

    return useMemo(() => {
        const assets: Map<string, PeraAsset> = new Map()
        queries.forEach(query => {
            query.data?.results?.forEach(asset => {
                assets.set(asset.assetId, asset)
            })
        })
        return {
            data: assets,
            isPending: queries.some(query => query.isPending),
            isFetched: queries.some(query => query.isFetched),
            isRefetching: queries.some(query => query.isRefetching),
            isError: queries.some(query => query.isError),
        }
    }, [queries])
}
