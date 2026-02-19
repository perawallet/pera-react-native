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

import {
    Networks,
    queryClient,
    type Network,
} from '@perawallet/wallet-core-shared'
import type {
    AssetResponse,
    AssetsResponse,
    IndexerAssetResponse,
    PublicAssetResponse,
} from '../../models'

export const fetchAssets = async (assetIDs: string[]) => {
    const response = await queryClient<AssetsResponse, string[]>({
        backend: 'pera',
        network: Networks.mainnet,
        method: 'GET',
        url: `/v1/assets/`,
        params: {
            asset_ids: assetIDs.join(','),
        },
    })

    return response.data
}

export const fetchAccountAssets = async (address: string, network: Network) => {
    const response = await queryClient<AssetsResponse, string>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/v2/accounts/${address}/assets/`,
    })

    return response.data
}

export const fetchAssetDetails = async (assetID: string) => {
    const response = await queryClient<AssetResponse, string>({
        backend: 'pera',
        network: Networks.mainnet,
        method: 'GET',
        url: `/v1/assets/${assetID}`,
    })

    return response.data
}

export const fetchPublicAssetDetails = async (assetID: string) => {
    const response = await queryClient<PublicAssetResponse, string>({
        backend: 'pera',
        network: Networks.mainnet,
        method: 'GET',
        url: `/v1/public/assets/${assetID}`,
    })

    return response.data
}

export const fetchIndexerAssetDetails = async (assetID: string) => {
    const response = await queryClient<IndexerAssetResponse, string>({
        backend: 'indexer',
        network: Networks.mainnet,
        method: 'GET',
        url: `/v2/assets/${assetID}`,
    })

    return response.data
}
