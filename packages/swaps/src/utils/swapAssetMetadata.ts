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
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { SwapAsset } from '../models'

// Read per call, not at load: a test that mocks the assets package without
// the tier map would otherwise fail on import.
const isVerificationTier = (tier: string): tier is PeraAssetVerificationTier =>
    (Object.values(PeraAssetVerificationTier) as string[]).includes(tier)

/**
 * The router's tier as the asset store's; one this client doesn't know reads
 * as unverified so it never reaches the badge.
 */
export const swapAssetTierOf = (
    swapAsset: Pick<SwapAsset, 'verificationTier'>,
): PeraAssetVerificationTier =>
    isVerificationTier(swapAsset.verificationTier)
        ? swapAsset.verificationTier
        : PeraAssetVerificationTier.unverified

/** A stand-in for an asset the store has no row for yet. */
export const peraAssetFromSwapAsset = (swapAsset: SwapAsset): PeraAsset => ({
    assetId: swapAsset.assetId,
    decimals: swapAsset.decimals ?? 0,
    creator: { address: '' },
    totalSupply: new Decimal(0),
    name: swapAsset.name,
    unitName: swapAsset.unitName,
    peraMetadata: {
        isDeleted: false,
        verificationTier: swapAssetTierOf(swapAsset),
        logo: swapAsset.logo,
    },
})

/**
 * `asset` with the router's logo when the store has none; the same object
 * otherwise, so callers can tell nothing changed.
 */
export const withSwapAssetLogo = (
    asset: PeraAsset,
    swapAsset: SwapAsset,
): PeraAsset => {
    if (asset.peraMetadata?.logo || !swapAsset.logo) return asset
    return {
        ...asset,
        peraMetadata: {
            isDeleted: false,
            verificationTier: swapAssetTierOf(swapAsset),
            ...asset.peraMetadata,
            logo: swapAsset.logo,
        },
    }
}
