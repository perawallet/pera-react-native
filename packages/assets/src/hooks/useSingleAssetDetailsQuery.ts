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

import { useQuery } from '@tanstack/react-query'
import {
    ALGO_ASSET,
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
import {
    isAlgoAssetId,
    stripNulls,
    type Network,
} from '@perawallet/wallet-core-shared'
import { hasPeraServiceFallback } from '@perawallet/wallet-core-config'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getAssetById } from '../db'

/**
 * Re-asserts the real chain's values for fields that are facts about the chain
 * rather than Pera's opinion about the asset.
 *
 * On a network whose Pera services are borrowed, `peraData` describes the SAME
 * asset id on a DIFFERENT chain. Letting it win on `decimals` would make
 * `displayUnitsToBaseUnits` build a wrong-amount transaction that then SUCCEEDS
 * on chain — the one silent-wrong path the fallback would otherwise introduce.
 *
 * MainNet/TestNet merge order is untouched. Delete this helper and its call site
 * alongside pera-service-fallback.ts.
 */
const withChainIntrinsics = (
    merged: PeraAsset,
    indexerData: Partial<PeraAsset>,
): PeraAsset => ({
    ...merged,
    name: indexerData.name ?? merged.name,
    unitName: indexerData.unitName ?? merged.unitName,
    decimals: indexerData.decimals ?? merged.decimals,
    totalSupply: indexerData.totalSupply ?? merged.totalSupply,
    creator: indexerData.creator ?? merged.creator,
})

export const fetchAssetFromApis = async (
    assetId: string,
    network: Network,
): Promise<PeraAsset> => {
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

    const merged: PeraAsset = {
        ...DEFAULT_ASSET_VALUES,
        assetId,
        ...indexerData,
        ...(peraData ? stripNulls(peraData) : {}),
        ...(publicData ? stripNulls(publicData) : {}),
        peraMetadata: {
            ...DEFAULT_ASSET_METADATA,
            ...(peraData?.peraMetadata ?? {}),
        },
    }

    return indexerData && hasPeraServiceFallback(network)
        ? withChainIntrinsics(merged, indexerData)
        : merged
}

export const useSingleAssetDetailsQuery = (
    assetId: string,
    useDB: boolean = true,
) => {
    const { network } = useNetwork()

    return useQuery<PeraAsset, Error>({
        queryKey: getAssetDetailsQueryKey(assetId, useDB, network),
        queryFn: async (): Promise<PeraAsset> => {
            // Try DB first (data synced by sync service)
            if (useDB) {
                const dbAsset = await getAssetById({ assetId, network })
                if (dbAsset !== null) {
                    return dbAsset
                }
            }

            // ALGO is seeded at startup — if not in DB yet, return in-memory constant
            if (isAlgoAssetId(assetId)) {
                return ALGO_ASSET
            }

            // Fallback to API for assets not in DB (e.g., non-held assets)
            return fetchAssetFromApis(assetId, network)
        },
        staleTime: Infinity,
        enabled: !!assetId.length,
        // SQLite is the source of truth; run the queryFn even while offline instead
        // of pausing it (TanStack's default networkMode: 'online'), which would strand
        // consumers in `pending`. The network fallback uses Promise.allSettled and
        // never rejects, so running it offline is safe (it simply yields empty data).
        networkMode: 'always',
    })
}
