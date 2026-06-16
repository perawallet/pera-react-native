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

import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import type { DexSwapAsset } from '../../models'
import type { DexSwapAssetApiResponse } from './schema'

export const transformDexSwapAsset = (
    data: DexSwapAssetApiResponse,
): DexSwapAsset => ({
    assetId: data.asset_id ?? ALGO_ASSET_ID,
    logo: data.logo ?? undefined,
    name: data.name,
    unitName: data.unit_name,
    total: data.total,
    decimals: data.fraction_decimals,
    verificationTier: data.verification_tier,
    usdValue: data.usd_value,
})
