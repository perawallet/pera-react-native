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

import { useMemo } from 'react'
import { useAssetsStore } from '../store'
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
import { useNetwork } from '@perawallet/wallet-core-platform-integration'

export const useAssetPricesQuery = (enabled?: boolean) => {
    const { network } = useNetwork()
    const assetIDs = useAssetsStore(state => state.assetIDs)

    const queriesDefinitions = useMemo(() => {
        const chunks = partition(
            assetIDs.filter(id => id !== ALGO_ASSET_ID),
            DEFAULT_PAGE_SIZE,
        )

        return [
            ...chunks.map(chunk => {
                return {
                    queryKey: getAssetPricesQueryKey(chunk),
                    enabled: enabled ?? true,
                    queryFn: async () => fetchAssetPrices(chunk),
                    select: (data: { results: AssetPriceResponse[] }) => {
                        return {
                            results: data.results.map(asset => ({
                                asset_id: `${asset.asset_id}`,
                                usd_value: asset.usd_value,
                            })),
                        }
                    },
                }
            }),
            {
                queryKey: getAssetPricesQueryKey([ALGO_ASSET_ID]),
                enabled: enabled ?? true,
                queryFn: async () => fetchPublicAssetDetails(ALGO_ASSET_ID, network),
                select: (data: PublicAssetResponse) => {
                    return {
                        results: [
                            {
                                asset_id: ALGO_ASSET_ID,
                                usd_value: data.usd_value ?? '0',
                            },
                        ],
                    }
                },
            },
        ]
    }, [assetIDs, enabled])

    const queries = useQueries({
        queries: queriesDefinitions,
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
