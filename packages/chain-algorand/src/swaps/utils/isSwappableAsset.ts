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

import { isCollectible, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { Optional } from '@perawallet/wallet-core-shared'

// Category 1 = RUG_NINJA — swappable despite unverified tier.
// Update this when the category enum is added (see PeraAsset.peraMetadata.category TODO in models/assets.ts).
const RUG_NINJA_CATEGORY_ID = 1

const SWAPPABLE_VERIFICATION_TIERS = new Set(['verified', 'trusted'])

export const isSwappableAsset = (asset: Optional<PeraAsset>): boolean => {
    if (!asset) return false
    if (isCollectible(asset)) return false

    const meta = asset.peraMetadata
    const tier = meta?.verificationTier ?? ''
    return (
        SWAPPABLE_VERIFICATION_TIERS.has(tier) ||
        meta?.category === RUG_NINJA_CATEGORY_ID
    )
}
