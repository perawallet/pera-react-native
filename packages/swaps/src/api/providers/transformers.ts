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

import type { SwapProviderItem, TopPairItem } from '../../models'
import { transformDexSwapAsset } from '../available-assets/transformers'
import type { ProviderItemApiResponse, TopPairItemApiResponse } from './schema'

export const transformProviderItem = (
    data: ProviderItemApiResponse,
): SwapProviderItem => ({
    name: data.name,
    displayName: data.display_name,
    iconUrl: data.icon_url,
})

export const transformTopPairItem = (
    data: TopPairItemApiResponse,
): TopPairItem => ({
    assetA: transformDexSwapAsset(data.asset_a),
    assetB: transformDexSwapAsset(data.asset_b),
    volume24hUsd: data.volume_24h_usd,
})
