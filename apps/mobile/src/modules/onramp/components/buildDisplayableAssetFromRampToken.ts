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
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { ALGO_ASSET_ID, isAlgoAssetName } from '@perawallet/wallet-core-shared'

// ALGO needs assetId '0' so AssetIcon renders the built-in Algo SVG via
// isAlgoAssetId(). Other tokens use the token id as assetId and rely on the
// backend-provided logo URL passed separately to AssetIcon's `logoUrl`.
export const buildDisplayableAssetFromRampToken = (
    token: RampToken,
): DisplayableAsset => {
    const isAlgo = isAlgoAssetName(token.id) || isAlgoAssetName(token.symbol)
    return {
        assetId: isAlgo ? ALGO_ASSET_ID : token.id,
        name: token.name,
        unitName: token.symbol,
    }
}
