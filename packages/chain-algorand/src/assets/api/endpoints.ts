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
 * Each answered id's cross-chain group, keyed by ASA id; at most 500 ids. An id
 * the answer leaves out is absent, so only that token stays unread. ALGO is
 * `asa:0` on this endpoint.
 */
export const fetchCrossChainAssetGroups = async (
    assetIDs: string[],
    network: AlgorandNetworkId,
): Promise<Map<string, Nullable<AssetGroup>>> => {
    const caip2 = algorandDescriptor.networks.find(
        each => each.id === network,
    )?.caip2
    if (!caip2) throw new Error(`${network} has no CAIP-2 id`)

    const assetIdOf = new Map(assetIDs.map(id => [`${caip2}/asa:${id}`, id]))
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        scope: algorandScope(network),
        method: 'POST',
        url: '/api/v4/assets/',
        headers: buildIntegrityHeaders(),
        data: { ids: [...assetIdOf.keys()] },
    })
    const { results } = crossChainAssetGroupsResponseSchema.parse(data)
    return new Map(
        results.flatMap(item => {
            const assetId = assetIdOf.get(item.asset_id)
            return assetId === undefined
                ? []
                : [[assetId, item.cross_chain_asset_group] as const]
        }),
    )
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
