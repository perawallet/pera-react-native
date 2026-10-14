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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { rampTokenAsset, type RampToken } from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'

// A token with an asset on the account's chain resolves to that asset's id, so
// AssetIcon renders its glyph. Any other token (fiat, another chain's coin)
// keeps the ramp id and relies on the backend logo passed as `logoUrl`.
export const buildDisplayableAssetFromRampToken = (
    token: RampToken,
    scope: Nullable<ChainScope>,
): DisplayableAsset => {
    return {
        assetId:
            (scope === null ? null : rampTokenAsset(token, scope))?.assetId ??
            token.id,
        name: token.name,
        unitName: token.symbol,
    }
}
