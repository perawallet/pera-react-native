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
import { Linking } from 'react-native'
import { type PeraAsset, toWholeUnits } from '@perawallet/wallet-core-assets'
import {
    addressCodecs,
    type ChainScope,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    formatWithUnits,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useClipboard } from '@hooks/useClipboard'
import { chainUiFor } from '@modules/chain-ui'
import { useWebView } from '@modules/webview'
import { routeCapabilities } from '@routes/capabilities'
import { extractDomain } from '../../utils/extractDomain'
import { neutralCollectibleDetailsDisplay } from './neutralCollectibleDetailsDisplay'

export type UseCollectibleInfoResult = {
    identityLabelKey: I18nKey
    creatorLabelKey: I18nKey
    creatorDisplayAddress: string
    onCreatorPressed?: () => void
    onCreatorLongPressed: () => void
    onAssetIdPressed: () => void
    onAssetIdLongPressed: () => void
    onOpenExplorer?: () => void
    /** Null shows `explorerDomain` instead. */
    explorerLabelKey: Nullable<I18nKey>
    explorerDomain: Optional<string>
    hasTotalSupply: boolean
    totalSupplyAmount: ReturnType<typeof formatWithUnits>['amount']
    totalSupplyUnit: ReturnType<typeof formatWithUnits>['unit']
}

export const useCollectibleInfo = (
    asset: PeraAsset,
    scope: ChainScope,
): UseCollectibleInfoResult => {
    const { pushWebView } = useWebView()
    const { navigate } = useAppNavigation()
    const { copyToClipboard } = useClipboard()
    const descriptor = getChainDescriptor(scope.chainId)
    const display =
        chainUiFor(descriptor.family).collectibleDetails ??
        neutralCollectibleDetailsDisplay
    const creatorAddress = asset.creator.address

    // Both undefined on a network with no explorer (a custom one), so the rows
    // stop being CTAs rather than opening a link that goes nowhere.
    const creatorUrl = creatorAddress
        ? descriptor.explorer.accountUrl(scope.networkId, creatorAddress)
        : undefined
    const explorerUrl = descriptor.explorer.collectibleUrl(
        scope.networkId,
        asset.assetId,
    )

    // Same gate every other external link in the app uses (e.g.
    // useSettingsScreen's help-center links): the in-app webview bottom
    // sheet renders an iframe on web, which isn't a real webview and can't
    // load arbitrary external sites reliably (no bridge, and most sites'
    // frame-ancestors/X-Frame-Options block being embedded at all). Off ⇒
    // Linking.openURL, which react-native-web maps to a real window.open in
    // a new tab.
    const openExternalLink = useCallback(
        (url: string) => {
            if (!routeCapabilities.inAppWebView) {
                // oxlint-disable-next-line pera/no-unvalidated-open-url -- callers build on the chain descriptor's explorer
                void Linking.openURL(url)
                return
            }
            // oxlint-disable-next-line pera/no-unvalidated-open-url -- callers build on the chain descriptor's explorer
            pushWebView({ url })
        },
        [pushWebView],
    )

    const creatorPressed = useCallback(() => {
        if (creatorUrl) openExternalLink(creatorUrl)
    }, [creatorUrl, openExternalLink])

    const onAssetIdPressed = useCallback(() => {
        navigate('AssetDetails', {
            assetId: asset.assetId,
            chainId: scope.chainId,
            isCollectible: true,
        })
    }, [asset.assetId, navigate, scope.chainId])

    const openExplorer = useCallback(() => {
        if (explorerUrl) openExternalLink(explorerUrl)
    }, [explorerUrl, openExternalLink])

    // Copies the full address — the row shows it truncated.
    const onCreatorLongPressed = useCallback(
        () => void copyToClipboard(creatorAddress),
        [copyToClipboard, creatorAddress],
    )

    const onAssetIdLongPressed = useCallback(
        () => void copyToClipboard(String(asset.assetId)),
        [copyToClipboard, asset.assetId],
    )

    const { amount: totalSupplyAmount, unit: totalSupplyUnit } =
        formatWithUnits(toWholeUnits(asset.totalSupply, asset))

    return {
        identityLabelKey: display.identityLabelKey,
        creatorLabelKey: display.creatorLabelKey,
        creatorDisplayAddress: creatorAddress
            ? addressCodecs.get(scope.chainId).truncate(creatorAddress)
            : '',
        onCreatorPressed: creatorUrl ? creatorPressed : undefined,
        onCreatorLongPressed,
        onAssetIdPressed,
        onAssetIdLongPressed,
        onOpenExplorer: explorerUrl ? openExplorer : undefined,
        explorerLabelKey: display.explorerLabelKey,
        explorerDomain: explorerUrl ? extractDomain(explorerUrl) : undefined,
        hasTotalSupply: display.hasTotalSupply,
        totalSupplyAmount,
        totalSupplyUnit,
    }
}
