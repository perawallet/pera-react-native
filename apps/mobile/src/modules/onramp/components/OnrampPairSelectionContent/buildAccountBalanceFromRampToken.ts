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
import { type RampToken } from '@perawallet/wallet-core-onramp'
import { isAlgoAssetName, type Nullable } from '@perawallet/wallet-core-shared'

// Verification tier mapping for known onramp tokens, keyed on token.id.
// RampToken has no tier field; we map the known-safe tokens to a real
// PeraAssetVerificationTier here and keep the mapping local — no tier is
// fabricated on the domain model.
const RAMP_TOKEN_VERIFICATION_TIER: Record<string, PeraAssetVerificationTier> =
    {
        ALGO: PeraAssetVerificationTier.verified,
        USDC: PeraAssetVerificationTier.verified,
        USDC_ALGORAND: PeraAssetVerificationTier.verified,
    }

// Builds a synthetic AssetWithAccountBalance from a RampToken so onramp tokens
// can render through the standard AccountAssetItemView. RampToken has no real
// Algorand asset id (only ALGO maps to '0'); other tokens keep their provider id.
export const buildAccountBalanceFromRampToken = (
    token: RampToken,
    balance: Nullable<Decimal>,
): AssetWithAccountBalance => {
    const isAlgo = isAlgoAssetName(token.id) || isAlgoAssetName(token.symbol)
    const assetId = isAlgo ? '0' : token.id

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
                RAMP_TOKEN_VERIFICATION_TIER[token.id] ??
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
