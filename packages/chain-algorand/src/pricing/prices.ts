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

import { Decimal } from 'decimal.js'
import type { AssetPriceRow } from '@perawallet/wallet-core-assets'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import { fetchPublicAssetDetails } from '../assets/api'
import { fetchAssetPrices } from './endpoints'
import type { Network } from '@perawallet/wallet-core-shared'

export const fetchNativeUsdPrice = async (
    network: Network,
): Promise<Decimal> => {
    const details = await fetchPublicAssetDetails(ALGO_ASSET_ID, network)
    return new Decimal(details.usd_value ?? '0')
}

// The endpoint answers every requested id; `price: null` means "no price
// known", not a transport gap, so it is left out rather than priced 0.
export const fetchUsdPrices = async (
    assetIds: string[],
    network: Network,
): Promise<AssetPriceRow[]> => {
    const response = await fetchAssetPrices(assetIds, network)
    return response
        .filter(row => row.price !== null)
        .map(row => ({
            assetId: row.asset_id,
            usdPrice: new Decimal(row.price as string),
        }))
}
