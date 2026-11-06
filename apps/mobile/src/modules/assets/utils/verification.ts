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

import type { IconName } from '@components/core'
import { canHideHolding } from '@perawallet/wallet-core-accounts'
import {
    PeraAssetType,
    PeraAssetVerificationTier,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

const VERIFICATION_ICON_MAP: Record<string, Nullable<IconName>> = {
    verified: 'assets/verified',
    trusted: 'assets/trusted',
    suspicious: 'assets/suspicious',
    unverified: null,
}

export const getVerificationIcon = (
    verificationTier: string,
): Nullable<IconName> => {
    return VERIFICATION_ICON_MAP[verificationTier] ?? null
}

/**
 * The tier of a token Pera hasn't vetted, when the chain lets anyone send one
 * unasked. On an opt-in chain the user chose the asset, so it is never one.
 */
export const unvettedTierOf = (
    asset: DisplayableAsset,
    chainId: ChainId,
): Nullable<
    | typeof PeraAssetVerificationTier.unverified
    | typeof PeraAssetVerificationTier.suspicious
> => {
    const tier = asset.peraMetadata?.verificationTier
    if (
        tier !== PeraAssetVerificationTier.unverified &&
        tier !== PeraAssetVerificationTier.suspicious
    ) {
        return null
    }
    if (asset.peraMetadata?.type === PeraAssetType.collectible) return null
    return canHideHolding(chainId, asset.assetId) ? tier : null
}
