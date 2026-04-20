/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { AssetSearchItem } from '@perawallet/wallet-core-assets'
import type { IconName } from '@components/core'
import { getVerificationIcon } from '@modules/assets/utils/verification'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseAssetSearchItemResult = {
    isCollectible: boolean
    thumbnailUri: Nullable<string>
    displayName: string
    subtitle: string
    fallbackInitial: string
    verificationIcon: Nullable<IconName>
}

export const useAssetSearchItem = (
    item: AssetSearchItem,
): UseAssetSearchItemResult => {
    const isCollectible = item.type === 'collectible'

    const thumbnailUri = isCollectible
        ? (item.collectibleImage ?? item.logo)
        : item.logo

    const displayName = isCollectible
        ? (item.collectibleTitle ?? item.name ?? `Asset ${item.assetId}`)
        : (item.name ?? `Asset ${item.assetId}`)

    const subtitleLeading = isCollectible ? item.collectionName : item.unitName
    const subtitle = [subtitleLeading, item.assetId]
        .filter(Boolean)
        .join(' \u00B7 ')

    const fallbackInitial = (item.unitName ?? item.name ?? '?')
        .charAt(0)
        .toUpperCase()

    const verificationIcon = getVerificationIcon(item.verificationTier)

    return {
        isCollectible,
        thumbnailUri,
        displayName,
        subtitle,
        fallbackInitial,
        verificationIcon,
    }
}
