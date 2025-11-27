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

import { useCallback, useEffect, useMemo } from 'react'
import { useAssetsStore } from '../store'
import { useQueries } from '@tanstack/react-query'
import { fetchAssets, fetchPublicAssetDetails } from './endpoints'
import { mapAssetResponseToPeraAsset, mapPublicAssetResponseToPeraAsset } from './mappers'
import { ALGO_ASSET_ID, AssetsResponse, PublicAssetResponse, type PeraAsset } from '../models'
import { DEFAULT_PAGE_SIZE } from '@perawallet/wallet-core-shared'

export const getAssetsQueryKeys = (assetIDs: string[]) => {
    return ['v1', 'assets', { asset_ids: assetIDs.join(',') }]
}

export const getAlgoQueryKeys = () => {
    return ['v1', 'assets', 'algo']
}

export const useAssetsQuery = (ids?: string[]) => {
    let assetIDs = useAssetsStore(state => state.assetIDs)
    let updated = false
    const setAssetIDs = useAssetsStore(state => state.setAssetIDs)

    if (ids && (!assetIDs || !ids.every(id => assetIDs?.find(a => a === id)))) {
        const set = new Set([...(assetIDs ?? []), ...ids])
        assetIDs = [...set]
        updated = true
    }

    useEffect(() => {
        if (updated) {
            setAssetIDs(assetIDs)
        }
    }, [assetIDs, setAssetIDs, updated])

    const chunks = useMemo(() => {
        const chunks: string[][] = []
        for (let i = 0; i < assetIDs.length; i += DEFAULT_PAGE_SIZE) {
            chunks.push(
                assetIDs.slice(i, i + DEFAULT_PAGE_SIZE).map(id => `${id}`),
            )
        }
        return chunks
    }, [assetIDs])

    const queries = useQueries({
        queries: [...chunks.map(chunk => {
            return {
                queryKey: getAssetsQueryKeys(chunk),
                queryFn: async () => fetchAssets(chunk),
                select: useCallback((data: AssetsResponse) => {
                    const peraAssets = data.results.map(mapAssetResponseToPeraAsset)
                    return {
                        results: peraAssets,
                        next: data.next,
                        previous: data.previous,
                    }
                }, [mapAssetResponseToPeraAsset]),
            }
        }),
        {
            queryKey: getAlgoQueryKeys(),
            queryFn: async () => fetchPublicAssetDetails(ALGO_ASSET_ID),
            select: useCallback((data: PublicAssetResponse) => {
                const peraAsset = mapPublicAssetResponseToPeraAsset(data)
                return {
                    results: [peraAsset],
                    next: null,
                    previous: null,
                }
            }, [mapPublicAssetResponseToPeraAsset]),
        },
        ],
    })

    return useMemo(() => {
        const assets: Map<string, PeraAsset> = new Map()
        queries.forEach(query => {
            query.data?.results?.forEach(asset => {
                assets.set(asset.assetId, asset)
            })
        })
        return {
            assets,
            isPending: queries.some(query => query.isPending),
            isFetched: queries.some(query => query.isFetched),
            isRefetching: queries.some(query => query.isRefetching),
            isError: queries.some(query => query.isError),
        }
    }, [queries])
}
