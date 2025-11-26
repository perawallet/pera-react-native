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
    type HistoryPeriod,
    type ResponseErrorConfiguration,
} from '@perawallet/wallet-core-shared'
import type {
    AssetPriceHistoryResponse,
    AssetPricesResponse,
    AssetResponse,
    AssetsResponse,
    IndexerAssetResponse,
    PublicAssetResponse,
} from '../models'

const getAssetFiatPricesEndpoint = () => {
    return `/v1/assets/`
}

const getAssetPriceHistoryEndpoint = () => {
    return `/v1/assets/price-chart/`
}

const getAssetDetailsEndpoint = (assetID: string) => {
    return `/v1/assets/${assetID}`
}

const getPublicAssetDetailsEndpoint = (assetID: string) => {
    return `/v1/public/assets/${assetID}`
}

const getIndexerAssetDetailsEndpoint = (assetID: string) => {
    return `/v2/assets/${assetID}`
}

/*
 * Note: We intentionally always fetch assetIDs from mainnet because the pricing and details on testnet are not always up to date
 * or present.
 */

export const fetchAssetFiatPrices = async (assetIDs: string[]) => {
    const response = await queryClient<
        AssetPricesResponse,
        ResponseErrorConfiguration<Error>,
        string[]
    >({
        backend: 'pera',
        network: Networks.mainnet,
        method: 'GET',
        url: getAssetFiatPricesEndpoint(),
        params: {
            asset_ids: assetIDs.join(','),
        },
    })

    return response.data
}

export const fetchAssets = async (assetIDs: string[]) => {
    const response = await queryClient<
        AssetsResponse,
        ResponseErrorConfiguration<Error>,
        string[]
    >({
        backend: 'pera',
        network: Networks.mainnet,
        method: 'GET',
        url: getAssetFiatPricesEndpoint(),
        params: {
            asset_ids: assetIDs.join(','),
        },
    })

    return response.data
}

export async function fetchAssetPriceHistory(
    assetID: string,
    period: HistoryPeriod,
) {
    const res = await queryClient<
        AssetPriceHistoryResponse,
        ResponseErrorConfiguration<Error>,
        unknown
    >({
        backend: 'pera',
        network: Networks.mainnet,
        method: 'GET',
        url: getAssetPriceHistoryEndpoint(),
        params: {
            asset_id: assetID,
            period,
        },
    })

    return res.data
}

export const fetchAssetDetails = async (assetID: string) => {
    const response = await queryClient<
        AssetResponse,
        ResponseErrorConfiguration<Error>,
        string
    >({
        backend: 'pera',
        network: Networks.mainnet,
        method: 'GET',
        url: getAssetDetailsEndpoint(assetID),
    })

    return response.data
}

export const fetchPublicAssetDetails = async (assetID: string) => {
    const response = await queryClient<
        PublicAssetResponse,
        ResponseErrorConfiguration<Error>,
        string
    >({
        backend: 'pera',
        network: Networks.mainnet,
        method: 'GET',
        url: getPublicAssetDetailsEndpoint(assetID),
    })

    return response.data
}

export const fetchIndexerAssetDetails = async (assetID: string) => {
    const response = await queryClient<
        IndexerAssetResponse,
        ResponseErrorConfiguration<Error>,
        string
    >({
        backend: 'indexer',
        network: Networks.mainnet,
        method: 'GET',
        url: getIndexerAssetDetailsEndpoint(assetID),
    })

    return response.data
}
