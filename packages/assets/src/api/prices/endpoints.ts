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
} from '@perawallet/wallet-core-shared'
import {
    assetPriceHistoryResponseSchema,
    assetPricesResponseSchema,
    type AssetPriceHistoryResponse,
    type AssetPricesResponse,
} from './schema'

export const fetchAssetPrices = async (assetIDs: string[]) => {
    const response = await queryClient<AssetPricesResponse, string[]>({
        backend: 'pera',
        network: Networks.mainnet,
        method: 'GET',
        url: `/v1/assets/`,
        params: {
            asset_ids: assetIDs.join(','),
        },
    })

    return assetPricesResponseSchema.parse(response.data)
}

export const fetchAssetPriceHistory = async (
    assetID: string,
    period: HistoryPeriod,
) => {
    const res = await queryClient<AssetPriceHistoryResponse, unknown>({
        backend: 'pera',
        network: Networks.mainnet,
        method: 'GET',
        url: `/v1/assets/price-chart/`,
        params: {
            asset_id: assetID,
            period,
        },
    })

    return assetPriceHistoryResponseSchema.parse(res.data)
}
