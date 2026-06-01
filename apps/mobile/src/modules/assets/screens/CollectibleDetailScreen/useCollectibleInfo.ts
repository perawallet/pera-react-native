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

import { useAppNavigation } from '@hooks/useAppNavigation'
import { useWebView } from '@modules/webview'
import { PeraAsset, toWholeUnits } from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { formatWithUnits } from '@perawallet/wallet-core-shared'
import { useCallback } from 'react'

export const useCollectibleInfo = (asset: PeraAsset) => {
    const { pushWebView } = useWebView()
    const { network } = useNetwork()
    const config = getNetworkConfig(network)
    const { navigate } = useAppNavigation()

    const onCreatorPressed = useCallback(() => {
        pushWebView({
            url: `${config.explorerUrl}/address/${asset.creator.address}`,
        })
    }, [asset.creator.address, pushWebView])

    const onAssetIdPressed = useCallback(() => {
        navigate('AssetDetails', {
            assetId: asset.assetId,
            isCollectible: true,
        }) // Navigate to the Asset Details screen
    }, [asset.assetId, pushWebView])

    const onOpenExplorer = useCallback(() => {
        pushWebView({
            url: `${config.explorerUrl}/asset/${asset.assetId}`,
        })
    }, [asset.assetId, pushWebView])

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
