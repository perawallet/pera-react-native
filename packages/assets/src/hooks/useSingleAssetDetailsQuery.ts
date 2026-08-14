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
import {
    getAssetDetailsQueryKey,
    getRemoteAssetDetailsQueryKey,
} from './querykeys'
import {
    isAlgoAssetId,
    logger,
    stripNulls,
    type Network,
} from '@perawallet/wallet-core-shared'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getAssetById, upsertNodeAssets } from '../db'
import { assetBatchQueue } from '../services/assetBatchQueue'

/**
 * Re-asserts the real chain's values for fields that are facts about the chain
 * rather than Pera's opinion about the asset.
 *
 * Pera requests on a network with no Pera deployment now fail outright, so
 * `peraData` should never describe the same asset id on a DIFFERENT chain.
 * This is defence-in-depth against exactly that: `fetchAssetFromApis` is
 * exported, and its chain-truth guarantee must not depend on a chokepoint
 * that lives in another package (the ky client in `packages/shared`). If that
 * remote invariant ever breaks, the failure mode without this guard is a
 * foreign `decimals` making `displayUnitsToBaseUnits` build a wrong-amount
 * transaction that then SUCCEEDS on chain — lost funds, not an error.
 *
 * MainNet/TestNet merge order is untouched.
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

    const asset =
        indexerData && !isPeraBackedNetwork(network)
            ? withChainIntrinsics(merged, indexerData)
            : merged

    // Warm assets_node so the next read of this asset is DB-local instead of
    // re-fanning these three requests. Node half ONLY: the detail endpoint is
    // not device-scoped, so its pera opinion (is_favorited et al) must never
    // overwrite assets_pera — the device-scoped bulk sync owns that table.
    // Guarded on an authoritative lane so an all-defaults merge (e.g. every
    // endpoint failed offline) can't poison decimals in the DB.
    if (peraData || indexerData) {
        try {
            await upsertNodeAssets({ items: [asset], network })
        } catch (error) {
            logger.warn('Asset detail persist failed', {
                assetId,
                network,
                error,
            })
        }
    }

    return asset
}

export const useSingleAssetDetailsQuery = (
    assetId: string,
    useDB: boolean = true,
) => {
    const { network } = useNetwork()

    return useQuery<PeraAsset, Error>({
        // The remote variant keeps a distinct entry — see
        // getRemoteAssetDetailsQueryKey for why it can't share the canonical
        // one.
        queryKey: useDB
            ? getAssetDetailsQueryKey(assetId, network)
            : getRemoteAssetDetailsQueryKey(assetId, network),
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

            // DB miss (e.g. a non-held asset in the tx history): resolve
            // through the batch queue — it coalesces concurrent per-row
            // lookups into one bulk fetch and persists, so the next read is
            // local.
            if (useDB) {
                const fetched = await assetBatchQueue.enqueue(assetId, network)
                if (fetched) {
                    return fetched
                }
            }

            // Last resort — and the whole path for useDB=false: merge the
            // per-asset detail endpoints.
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
