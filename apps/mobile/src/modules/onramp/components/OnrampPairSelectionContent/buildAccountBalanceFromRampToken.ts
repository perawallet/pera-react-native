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
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import {
    rampTokenAssetId,
    type RampToken,
} from '@perawallet/wallet-core-chain-algorand/onramp'
import { ALGO_ASSET_ID, type Nullable } from '@perawallet/wallet-core-shared'

// RampToken carries no tier, so the known-safe listings are mapped here rather
// than fabricating one on the domain model. Keyed on the resolved asset id, so
// a provider that lists ALGO under its on-chain id is still recognised.
const RAMP_TOKEN_VERIFICATION_TIER: Record<string, PeraAssetVerificationTier> =
    {
        [ALGO_ASSET_ID]: PeraAssetVerificationTier.verified,
        USDC: PeraAssetVerificationTier.verified,
        USDC_ALGORAND: PeraAssetVerificationTier.verified,
    }

// Builds a synthetic AssetWithAccountBalance from a RampToken so onramp tokens
// can render through the standard AccountAssetItemView.
export const buildAccountBalanceFromRampToken = (
    token: RampToken,
    balance: Nullable<Decimal>,
): AssetWithAccountBalance => {
    const assetId = rampTokenAssetId(token)

    const asset: PeraAsset = {
        assetId,
        name: token.name,
        unitName: token.symbol,
        decimals: token.fractionDecimals,
        creator: { address: '' },
        totalSupply: new Decimal(0),
        peraMetadata: {
            ...DEFAULT_ASSET_METADATA,
            verificationTier:
                RAMP_TOKEN_VERIFICATION_TIER[assetId] ??
                DEFAULT_ASSET_METADATA.verificationTier,
        },
    }

    return {
        assetId,
        asset,
        amount: balance ?? new Decimal(0),
        algoValue: new Decimal(0),
        isFrozen: false,
    }
}
