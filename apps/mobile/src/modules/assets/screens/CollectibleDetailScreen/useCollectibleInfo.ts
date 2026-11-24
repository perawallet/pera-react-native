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
import { type PeraAsset, toWholeUnits } from '@perawallet/wallet-core-assets'
import {
    addressCodecs,
    type ChainScope,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    abbreviateLargeAmount,
    LONG_ADDRESS_LENGTH,
    truncateAlgorandAddress,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useClipboard } from '@hooks/useClipboard'
import { chainUiFor } from '@modules/chain-ui'
import { openExplorerUrl } from '@modules/webview'
import { extractDomain } from '../../utils/extractDomain'
import { neutralCollectibleDetailsDisplay } from './neutralCollectibleDetailsDisplay'

export type UseCollectibleInfoResult = {
    identityLabelKey: I18nKey
    creatorLabelKey: I18nKey
    creatorDisplayAddress: string
    onCreatorPressed?: () => void
    onCreatorLongPressed: () => void
    /** What the identity row shows, shortened; `onAssetIdLongPressed` copies it whole. */
    identityDisplay: string
    /** Undefined when the identity row doesn't open the asset's details. */
    onAssetIdPressed?: () => void
    onAssetIdLongPressed: () => void
    /** Undefined when the family lists no label for the collectible's standard. */
    standardLabel: Optional<string>
    onOpenExplorer?: () => void
    /** Null shows `explorerDomain` instead. */
    explorerLabelKey: Nullable<I18nKey>
    explorerDomain: Optional<string>
    hasTotalSupply: boolean
    totalSupplyAmount: ReturnType<typeof abbreviateLargeAmount>['amount']
    totalSupplyUnit: ReturnType<typeof abbreviateLargeAmount>['unit']
}

export const useCollectibleInfo = (
    asset: PeraAsset,
    scope: ChainScope,
): UseCollectibleInfoResult => {
    const { navigate } = useAppNavigation()
    const { copyToClipboard } = useClipboard()
    const descriptor = getChainDescriptor(scope.chainId)
    const display =
        chainUiFor(descriptor.family, scope.chainId).collectibleDetails ??
        neutralCollectibleDetailsDisplay
    const creatorAddress = asset.creator.address
    const identity = display.identityOf?.(asset.assetId) ?? asset.assetId
    const standard = asset.peraMetadata?.collectible?.standard

    // Both undefined on a network with no explorer (a custom one), so the rows
    // stop being CTAs rather than opening a link that goes nowhere.
    const creatorUrl = creatorAddress
        ? descriptor.explorer.accountUrl(scope.networkId, creatorAddress)
        : undefined
    const explorerUrl = descriptor.explorer.collectibleUrl(
        scope.networkId,
        asset.assetId,
    )

    const creatorPressed = useCallback(() => {
        if (creatorUrl) openExplorerUrl(creatorUrl)
    }, [creatorUrl])

    const onAssetIdPressed = useCallback(() => {
        navigate('AssetDetails', {
            assetId: asset.assetId,
            chainId: scope.chainId,
            isCollectible: true,
        })
    }, [asset.assetId, navigate, scope.chainId])

    const openExplorer = useCallback(() => {
        if (explorerUrl) openExplorerUrl(explorerUrl)
    }, [explorerUrl])

    // Copies the full address — the row shows it truncated.
    const onCreatorLongPressed = useCallback(
        () => void copyToClipboard(creatorAddress),
        [copyToClipboard, creatorAddress],
    )

    const onAssetIdLongPressed = useCallback(
        () => void copyToClipboard(identity),
        [copyToClipboard, identity],
    )

    const { amount: totalSupplyAmount, unit: totalSupplyUnit } =
        abbreviateLargeAmount(toWholeUnits(asset.totalSupply, asset), 2, {
            from: 'K',
        })

    return {
        identityLabelKey: display.identityLabelKey,
        creatorLabelKey: display.creatorLabelKey,
        creatorDisplayAddress: creatorAddress
            ? addressCodecs.get(scope.chainId).truncate(creatorAddress)
            : '',
        onCreatorPressed: creatorUrl ? creatorPressed : undefined,
        onCreatorLongPressed,
        identityDisplay: truncateAlgorandAddress(identity, LONG_ADDRESS_LENGTH),
        onAssetIdPressed: display.isIdentityLinked
            ? onAssetIdPressed
            : undefined,
        onAssetIdLongPressed,
        standardLabel:
            standard === undefined
                ? undefined
                : display.standardLabels?.[standard],
        onOpenExplorer: explorerUrl ? openExplorer : undefined,
        explorerLabelKey: display.explorerLabelKey,
        explorerDomain: explorerUrl ? extractDomain(explorerUrl) : undefined,
        hasTotalSupply: display.hasTotalSupply,
        totalSupplyAmount,
        totalSupplyUnit,
    }
}
