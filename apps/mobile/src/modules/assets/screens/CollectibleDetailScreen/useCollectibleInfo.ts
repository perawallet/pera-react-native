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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { formatWithUnits } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useWebView } from '@modules/webview'
import { routeCapabilities } from '@routes/capabilities'

export const useCollectibleInfo = (asset: PeraAsset) => {
    const { pushWebView } = useWebView()
    const { network } = useNetwork()
    const config = getNetworkConfig(network)
    const { navigate } = useAppNavigation()

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
                void Linking.openURL(url)
                return
            }
            pushWebView({ url })
        },
        [pushWebView],
    )

    const onCreatorPressed = useCallback(() => {
        openExternalLink(
            `${config.explorerUrl}/address/${asset.creator.address}`,
        )
    }, [asset.creator.address, openExternalLink, config.explorerUrl])

    const onAssetIdPressed = useCallback(() => {
        navigate('AssetDetails', {
            assetId: asset.assetId,
            isCollectible: true,
        }) // Navigate to the Asset Details screen
    }, [asset.assetId, navigate])

    const onOpenExplorer = useCallback(() => {
        openExternalLink(`${config.explorerUrl}/asset/${asset.assetId}`)
    }, [asset.assetId, openExternalLink, config.explorerUrl])

    const { amount: totalSupplyAmount, unit: totalSupplyUnit } =
        formatWithUnits(toWholeUnits(asset.totalSupply, asset))

    return {
        onCreatorPressed,
        onAssetIdPressed,
        onOpenExplorer,
        totalSupplyAmount,
        totalSupplyUnit,
    }
}
