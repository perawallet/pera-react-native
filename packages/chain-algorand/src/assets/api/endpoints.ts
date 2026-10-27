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

import { buildIntegrityHeaders } from '@perawallet/wallet-core-app-integrity'
import type { AssetGroup } from '@perawallet/wallet-core-assets'
import { queryClient, type Nullable } from '@perawallet/wallet-core-shared'
import { algorandDescriptor } from '../../descriptor'
import { fetchNodeJson } from '../../blockchain/utils/nodeHttp'
import {
    assetResponseSchema,
    assetsResponseSchema,
    crossChainAssetGroupsResponseSchema,
    indexerAssetResponseSchema,
    publicAssetResponseSchema,
    type AssetResponse,
    type AssetsResponse,
    type PublicAssetResponse,
} from './schema'
import { type AlgorandNetworkId, algorandScope } from '../../network-id'

const fetchAssetsForDevice = (
    assetIDs: string[],
    network: AlgorandNetworkId,
    deviceId: string,
) =>
    queryClient<AssetsResponse, string>({
        backend: 'pera',
        scope: algorandScope(network),
        method: 'POST',
        url: `/v2/assets/`,
        body: `{"device_id":${deviceId},"asset_ids":${JSON.stringify(
            assetIDs,
        )},"include_deleted":true}`,
    })

const fetchAssetsUnscoped = (assetIDs: string[], network: AlgorandNetworkId) =>
    queryClient<AssetsResponse, string[]>({
        backend: 'pera',
        scope: algorandScope(network),
        method: 'GET',
        url: `/v1/assets/`,
        params: {
            asset_ids: assetIDs.join(','),
            include_deleted: true,
        },
    })

export const fetchAssets = async (
    assetIDs: string[],
    network: AlgorandNetworkId,
    deviceId?: Nullable<string>,
) => {
    const response = deviceId
        ? await fetchAssetsForDevice(assetIDs, network, deviceId)
        : await fetchAssetsUnscoped(assetIDs, network)

    return assetsResponseSchema.parse(response.data)
}

/**
 * Each id's cross-chain group, in request order; at most 500 ids. ALGO is
 * `asa:0` on this endpoint.
 */
export const fetchCrossChainAssetGroups = async (
    assetIDs: string[],
    network: AlgorandNetworkId,
): Promise<Nullable<AssetGroup>[]> => {
    const caip2 = algorandDescriptor.networks.find(
        each => each.id === network,
    )?.caip2
    if (!caip2) throw new Error(`${network} has no CAIP-2 id`)

    const ids = assetIDs.map(id => `${caip2}/asa:${id}`)
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        scope: algorandScope(network),
        method: 'POST',
        url: '/api/v4/assets/',
        headers: buildIntegrityHeaders(),
        data: { ids },
    })
    const { results } = crossChainAssetGroupsResponseSchema.parse(data)
    // Position is the only key, so a misaligned answer would group the wrong asset.
    if (
        results.length !== ids.length ||
        results.some((item, index) => item.asset_id !== ids[index])
    ) {
        throw new Error('The asset groups answer does not match the request')
    }
    return results.map(item => item.cross_chain_asset_group)
}

export const fetchAssetDetails = async (
    assetID: string,
    network: AlgorandNetworkId,
) => {
    const response = await queryClient<AssetResponse, string>({
        backend: 'pera',
        scope: algorandScope(network),
        method: 'GET',
        url: `/v1/assets/${assetID}/`,
    })

    return assetResponseSchema.parse(response.data)
}

export const fetchPublicAssetDetails = async (
    assetID: string,
    network: AlgorandNetworkId,
) => {
    const response = await queryClient<PublicAssetResponse, string>({
        backend: 'pera',
        scope: algorandScope(network),
        method: 'GET',
        url: `/v1/public/assets/${assetID}/`,
    })

    return publicAssetResponseSchema.parse(response.data)
}

export const fetchIndexerAssetDetails = async (
    assetID: string,
    network: AlgorandNetworkId,
) => {
    const response = await fetchNodeJson(
        network,
        'indexer',
        `/v2/assets/${assetID}`,
    )

    return indexerAssetResponseSchema.parse(response)
}
