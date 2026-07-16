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

import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import type { DexSwapAsset } from '@perawallet/wallet-core-swaps'

export const dexSwapAssetToDisplayable = (
    asset: DexSwapAsset,
): DisplayableAsset => ({
    assetId: asset.assetId,
    name: asset.name,
    unitName: asset.unitName,
    decimals: asset.decimals,
    peraMetadata: asset.logo ? { logo: asset.logo } : undefined,
})
