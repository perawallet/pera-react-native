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
import {
    PeraServiceUnavailableError,
    queryClient,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { algorandDescriptor } from '../../descriptor'
import { fetchNodeJson } from '../../blockchain/utils/nodeHttp'
import {
    assetItemResponseSchema,
    assetItemsResponseSchema,
    assetResponseSchema,
    assetsResponseSchema,
    crossChainAssetGroupsResponseSchema,
    indexerAssetResponseSchema,
    publicAssetResponseSchema,
    type AssetItemResponse,
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

// Keyed by CAIP-19, valued by ASA id; null when the network has no CAIP-2 id.
const algorandAssetCaip19Ids = (
    assetIDs: string[],
    network: AlgorandNetworkId,
): Nullable<Map<string, string>> => {
    const caip2 = algorandDescriptor.networks.find(
        each => each.id === network,
    )?.caip2
    return caip2
        ? new Map(assetIDs.map(id => [`${caip2}/asa:${id}`, id]))
        : null
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
    const assetIdOf = algorandAssetCaip19Ids(assetIDs, network)
    if (!assetIdOf) throw new Error(`${network} has no CAIP-2 id`)

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

/**
 * Each answered id's full v4 item, keyed by ASA id; at most 500 ids. ALGO is
 * `asa:0`. A row this client can't read, or one it didn't ask for, is absent.
 * Rejects on a failed request, including 404 for an unknown device.
 */
export const fetchAssetItems = async (
    assetIDs: string[],
    network: AlgorandNetworkId,
    deviceId?: Nullable<string>,
): Promise<Map<string, AssetItemResponse>> => {
    if (assetIDs.length === 0) return new Map()
    const assetIdOf = algorandAssetCaip19Ids(assetIDs, network)
    if (!assetIdOf)
        throw new PeraServiceUnavailableError(algorandScope(network))

    const ids = [...assetIdOf.keys()]
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        scope: algorandScope(network),
        method: 'POST',
        url: '/api/v4/assets/',
        headers: buildIntegrityHeaders(),
        // A string: device ids are 63-bit, and the endpoint refuses a JSON
        // number because a JS number rounds them above 2^53.
        data: deviceId ? { ids, device_id: deviceId } : { ids },
    })
    const { results } = assetItemsResponseSchema.parse(data)
    return new Map(
        results.flatMap(row => {
            const assetId = assetIdOf.get(row.asset_id)
            const parsed = assetItemResponseSchema.safeParse(row)
            return assetId === undefined || !parsed.success
                ? []
                : [[assetId, parsed.data] as const]
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
