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

import {
    DEFAULT_ASSET_METADATA,
    DEFAULT_ASSET_VALUES,
    upsertNodeAssets,
    type AssetAuthorities,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import {
    logger,
    stripNulls,
    type Network,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    fetchAssetDetails,
    fetchIndexerAssetDetails,
    fetchPublicAssetDetails,
    transformAssetResponse,
    transformIndexerAssetResponse,
    transformPublicAssetResponse,
} from './api'

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
            await upsertNodeAssets({
                items: [asset],
                scope: scopeForLegacyNetwork(network),
            })
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

export const fetchOnChainAsset = async (
    assetId: string,
    network: Network,
): Promise<PeraAsset> =>
    transformIndexerAssetResponse(
        await fetchIndexerAssetDetails(assetId, network),
    )

// Nodes usually omit a cleared authority, but some serialize the all-zero
// address instead. Both mean "no authority".
const ZERO_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

const activeAuthority = (address: Optional<string>): Nullable<string> =>
    address && address !== ZERO_ADDRESS ? address : null

export const fetchAssetAuthorities = async (
    assetId: string,
    network: Network,
): Promise<AssetAuthorities> => {
    const response = await fetchIndexerAssetDetails(assetId, network)
    const params = response.asset.params
    const freeze = activeAuthority(params.freeze)
    const clawback = activeAuthority(params.clawback)
    return {
        hasFreeze: freeze !== null,
        hasClawback: clawback !== null,
        freezeAddress: freeze,
        clawbackAddress: clawback,
    }
}
