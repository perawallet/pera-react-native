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

import { Decimal } from 'decimal.js'
import type { AssetPrice } from '../../models'
import type { AssetPriceHistoryItem } from '../../models'
import type {
    AssetPriceResponse,
    AssetPriceHistoryResponseItem,
} from './schema'

export const transformAssetPriceResponse = (
    data: AssetPriceResponse,
): AssetPrice => {
    return {
        assetId: data.asset_id.toString(),
        usdPrice: new Decimal(data.usd_value ?? '0'),
    }
}

export const transformAssetPriceHistoryResponse = (
    data: AssetPriceHistoryResponseItem,
): AssetPriceHistoryItem => {
    return {
        datetime: new Date(data.datetime),
        usdPrice: new Decimal(data.price ?? '0'),
    }
}
