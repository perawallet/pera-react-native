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

import { useEffect, useMemo } from 'react'
import { useAssetsStore } from '../store'
import { useQueries } from '@tanstack/react-query'
import { fetchAssets } from './endpoints'
import { mapAssetResponseToPeraAsset } from './mappers'
import type { PeraAsset } from '../models'
import { DEFAULT_PAGE_SIZE } from '@perawallet/wallet-core-shared'

export const getAssetsQueryKeys = (assetIDs: string[]) => {
    return ['v1', 'assets', { asset_ids: assetIDs.join(',') }]
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
        queries: chunks.map(chunk => {
            return {
                queryKey: getAssetsQueryKeys(chunk),
                queryFn: async () => fetchAssets(chunk),
            }
        }),
    })

    return useMemo(() => {
        const assets: Map<string, PeraAsset> = new Map()
        queries.forEach(query => {
            query.data?.results?.forEach(asset => {
                const peraAsset = mapAssetResponseToPeraAsset(asset)
                assets.set(peraAsset.assetId, peraAsset)
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
