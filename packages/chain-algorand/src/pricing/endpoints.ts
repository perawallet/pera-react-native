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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import { assetPricesResponseSchema, type AssetPricesResponse } from './schema'

// Capped by the endpoint's own asset_ids validation.
export const ASSET_PRICES_MAX_IDS_PER_REQUEST = 100

export const fetchAssetPrices = async (
    assetIDs: string[],
    network: Network,
) => {
    const response = await queryClient<AssetPricesResponse, string[]>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/api/v3/asset-prices`,
        params: {
            asset_ids: assetIDs.join(','),
        },
    })

    return assetPricesResponseSchema.parse(response.data)
}
