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

import type { SwapHistoryItem, SwapDistinctPairItem } from '../../models'
import { transformDexSwapAsset } from '../available-assets/transformers'
import type {
    SwapHistoryItemApiResponse,
    SwapDistinctPairItemApiResponse,
} from './schema'

export const transformSwapHistoryItem = (
    data: SwapHistoryItemApiResponse,
): SwapHistoryItem => ({
    id: data.id,
    idStr: data.id_str,
    provider: data.provider,
    status: data.status,
    completedDatetime: data.completed_datetime,
    transactionGroupId: data.transaction_group_id,
    assetIn: transformDexSwapAsset(data.asset_in),
    assetOut: transformDexSwapAsset(data.asset_out),
    amountIn: new Decimal(data.amount_in),
    amountOut: new Decimal(data.amount_out),
    amountInUsdValue: data.amount_in_usd_value,
    amountOutUsdValue: data.amount_out_usd_value,
})

export const transformSwapDistinctPairItem = (
    data: SwapDistinctPairItemApiResponse,
): SwapDistinctPairItem => ({
    assetIn: transformDexSwapAsset(data.asset_in),
    assetOut: transformDexSwapAsset(data.asset_out),
    swapDatetime: data.swap_datetime,
    pairKey: data.pair_key,
})
