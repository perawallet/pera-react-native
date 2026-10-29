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

import { useCallback } from 'react'
import {
    useIsNativeAssetId,
    PeraAssetType,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { IconName } from '@components/core'
import { useClipboard } from '@hooks/useClipboard'
import { getVerificationIcon } from '@modules/assets/utils/verification'

type UseAssetItemViewOptions = {
    copyableAssetId?: boolean
    /** The asset's chain; an id that is an address on it shows truncated by its codec. */
    chainId?: ChainId
}

type UseAssetItemViewResult = {
    isCollectible: boolean
    isAlgo: boolean
    isSuspicious: boolean
    isDeleted: boolean
    displayName: string
    secondaryText: string
    verificationIcon: Nullable<IconName>
    iconShape: 'circle' | 'square'
    /** Row-level long-press copy. Undefined when copying is off or the asset
     *  is ALGO — its id (0) is never what the user wants on the clipboard. */
    onCopyAssetId: Optional<() => void>
}

export const useAssetItemView = (
    asset: DisplayableAsset,
    options?: UseAssetItemViewOptions,
): UseAssetItemViewResult => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { copyToClipboard } = useClipboard()
    const isNativeAssetId = useIsNativeAssetId(scope)
    const meta = asset.peraMetadata
    const isAlgo = isNativeAssetId(asset.assetId)
    const isCollectible = meta?.type === PeraAssetType.collectible
    const tier = meta?.verificationTier
    const isSuspicious = tier === 'suspicious'
    const isDeleted = meta?.isDeleted === true

    const verificationIconOf = (): Nullable<IconName> => {
        if (isAlgo) return 'assets/trusted'
        return tier ? getVerificationIcon(tier) : null
    }
    const verificationIcon = verificationIconOf()

    const chainId = options?.chainId
    const shownAssetId =
        chainId !== undefined &&
        addressCodecs.has(chainId) &&
        addressCodecs.get(chainId).isValid(asset.assetId)
            ? addressCodecs.get(chainId).truncate(asset.assetId)
            : asset.assetId

    const collectibleTitle = meta?.collectible?.title
    const collectionName = meta?.collectible?.collection?.name

    // `||` (not `??`) so empty-string names fall back to `Asset #<id>`,
    // matching the prior AccountAssetItemView behavior.
    const displayNameOf = () => {
        if (isAlgo) return 'Algo'
        if (isCollectible) {
            return collectibleTitle || asset.name || `Asset #${shownAssetId}`
        }
        return asset.name || `Asset #${shownAssetId}`
    }
    const displayName = displayNameOf()

    const subtitleLeading = isCollectible
        ? (collectionName ?? asset.unitName)
        : asset.unitName

    const secondaryTextOf = () => {
        if (isAlgo) return asset.unitName ?? ''
        return subtitleLeading
            ? `${subtitleLeading} · ${shownAssetId}`
            : shownAssetId
    }
    const secondaryText = secondaryTextOf()

    const copyAssetId = useCallback(
        () => void copyToClipboard(String(asset.assetId)),
        [copyToClipboard, asset.assetId],
    )

    return {
        isCollectible,
        isAlgo,
        isSuspicious,
        isDeleted,
        displayName,
        secondaryText,
        verificationIcon,
        iconShape: isCollectible ? 'square' : 'circle',
        onCopyAssetId:
            options?.copyableAssetId && !isAlgo ? copyAssetId : undefined,
    }
}
