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

import {
    PeraAssetType,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import { isAlgoAssetId, type Nullable } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { getVerificationIcon } from '@modules/assets/utils/verification'

type UseAssetItemViewResult = {
    isCollectible: boolean
    isAlgo: boolean
    isSuspicious: boolean
    isDeleted: boolean
    displayName: string
    secondaryText: string
    verificationIcon: Nullable<IconName>
    iconShape: 'circle' | 'square'
}

export const useAssetItemView = (
    asset: DisplayableAsset,
): UseAssetItemViewResult => {
    const meta = asset.peraMetadata
    const isAlgo = isAlgoAssetId(asset.assetId)
    const isCollectible = meta?.type === PeraAssetType.collectible
    const tier = meta?.verificationTier
    const isSuspicious = tier === 'suspicious'
    const isDeleted = meta?.isDeleted === true

    const verificationIcon: Nullable<IconName> = isAlgo
        ? 'assets/trusted'
        : tier
          ? getVerificationIcon(tier)
          : null

    const collectibleTitle = meta?.collectible?.title
    const collectionName = meta?.collectible?.collection?.name

    // `||` (not `??`) so empty-string names fall back to `Asset #<id>`,
    // matching the prior AccountAssetItemView behavior.
    const displayName = isAlgo
        ? 'Algo'
        : isCollectible
          ? collectibleTitle || asset.name || `Asset #${asset.assetId}`
          : asset.name || `Asset #${asset.assetId}`

    const subtitleLeading = isCollectible
        ? (collectionName ?? asset.unitName)
        : asset.unitName

    const secondaryText = isAlgo
        ? (asset.unitName ?? '')
        : subtitleLeading
          ? `${subtitleLeading} - ${asset.assetId}`
          : asset.assetId

    return {
        isCollectible,
        isAlgo,
        isSuspicious,
        isDeleted,
        displayName,
        secondaryText,
        verificationIcon,
        iconShape: isCollectible ? 'square' : 'circle',
    }
}
