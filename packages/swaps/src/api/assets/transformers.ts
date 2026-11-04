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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { SwapAsset } from '../../models'
import type { ResolveSwapAssetRef } from '../router-ids'
import type { SwapAssetItemApiResponse } from './schema'

/** Null when the item's id names no asset a swap chain can read. */
export const transformSwapAsset = (
    item: SwapAssetItemApiResponse,
    resolve: ResolveSwapAssetRef,
): Nullable<SwapAsset> => {
    const ref = resolve(item.asset_id)
    if (!ref) return null
    return {
        ref,
        assetId: ref.assetId,
        name: item.name ?? undefined,
        unitName: item.unit_name ?? undefined,
        decimals: item.fraction_decimals ?? undefined,
        logo: item.logo ?? undefined,
        verificationTier: item.verification_tier ?? 'unverified',
        crossChainAssetGroup: item.cross_chain_asset_group ?? null,
    }
}
