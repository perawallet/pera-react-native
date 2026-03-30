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
import {
    ALGO_ASSET,
    ALGO_ASSET_ID,
    DEFAULT_ASSET_METADATA,
    DEFAULT_ASSET_VALUES,
    type PeraAsset,
} from '../models'
import {
    transformAssetResponse,
    transformIndexerAssetResponse,
    transformPublicAssetResponse,
    fetchAssetDetails,
    fetchIndexerAssetDetails,
    fetchPublicAssetDetails,
} from '../api'
import { getAssetDetailsQueryKey } from './querykeys'
import { stripNulls, type Network } from '@perawallet/wallet-core-shared'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getAssetById, getAssetPeraMetadata } from '../db'

async function fetchAssetFromApis(
    assetId: string,
    network: Network,
): Promise<PeraAsset> {
    const [peraResult, indexerResult, publicResult] = await Promise.allSettled([
        fetchAssetDetails(assetId, network).then(transformAssetResponse),
        fetchIndexerAssetDetails(assetId, network).then(
            transformIndexerAssetResponse,
        ),
        fetchPublicAssetDetails(assetId, network).then(
            transformPublicAssetResponse,
        ),
    ])

    const peraData =
        peraResult.status === 'fulfilled' ? peraResult.value : undefined
    const indexerData =
        indexerResult.status === 'fulfilled' ? indexerResult.value : undefined
    const publicData =
        publicResult.status === 'fulfilled' ? publicResult.value : undefined

    return {
        ...DEFAULT_ASSET_VALUES,
        assetId,
        ...indexerData,
        ...(peraData ? stripNulls(peraData) : {}),
        ...(publicData ? stripNulls(publicData) : {}),
        peraMetadata: {
            ...DEFAULT_ASSET_METADATA,
            ...(indexerData?.peraMetadata ?? {}),
            ...(peraData?.peraMetadata ?? {}),
            ...(publicData?.peraMetadata ?? {}),
        },
    }
}

export const useSingleAssetDetailsQuery = (assetId: string) => {
    const { network } = useNetwork()

    return useQuery<PeraAsset, Error>({
        queryKey: getAssetDetailsQueryKey(assetId),
        queryFn: async (): Promise<PeraAsset> => {
            if (assetId === ALGO_ASSET_ID) {
                // Read device-specific metadata (isFavorited, isPriceAlertEnabled)
                // directly from the pera table — ALGO has no row in the node table
                // so getAssetById (which joins both) would return null
                const dbMeta = await getAssetPeraMetadata({
                    assetId,
                    network,
                })
                return {
                    ...ALGO_ASSET,
                    peraMetadata: {
                        ...DEFAULT_ASSET_METADATA,
                        ...ALGO_ASSET.peraMetadata,
                        ...(dbMeta ?? {}),
                    },
                }
            }

            // Try DB first (data synced by sync service)
            const dbAsset = await getAssetById({ assetId, network })
            if (dbAsset !== null) {
                return dbAsset
            }

            // Fallback to API for assets not in DB (e.g., non-held assets)
            return fetchAssetFromApis(assetId, network)
        },
        staleTime: Infinity,
        enabled: !!assetId.length,
    })
}
