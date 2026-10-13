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
import {
    DEFAULT_ASSET_METADATA,
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { rampTokenAsset, type RampToken } from '@perawallet/wallet-core-onramp'
import { type Nullable } from '@perawallet/wallet-core-shared'

// Builds a synthetic AssetWithAccountBalance from a RampToken so onramp tokens
// can render through the standard AccountAssetItemView. The verification tier
// comes from the asset the token arrives as; RampToken carries none.
export const buildAccountBalanceFromRampToken = (
    token: RampToken,
    balance: Nullable<Decimal>,
    scope: ChainScope,
    asset: Nullable<PeraAsset>,
): AssetWithAccountBalance => {
    const tokenAsset = rampTokenAsset(token, scope)
    const assetId = tokenAsset?.assetId ?? token.id

    const displayAsset: PeraAsset = {
        assetId,
        name: token.name,
        unitName: token.symbol,
        decimals: token.fractionDecimals,
        creator: { address: '' },
        totalSupply: new Decimal(0),
        peraMetadata: {
            ...DEFAULT_ASSET_METADATA,
            verificationTier: tokenAsset?.isNative
                ? PeraAssetVerificationTier.verified
                : (asset?.peraMetadata?.verificationTier ??
                  DEFAULT_ASSET_METADATA.verificationTier),
        },
    }

    return {
        assetId,
        asset: displayAsset,
        amount: balance ?? new Decimal(0),
        algoValue: new Decimal(0),
        fiatValue: null,
        isFrozen: false,
    }
}
