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

import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import { PWView } from '@components/core'
import { AssetIcon } from '@components/AssetIcon'
import { ChainAvatarBadge } from '@modules/chain-ui/icon'
import {
    swapAssetToDisplayable,
    type SwapIconAsset,
} from '@modules/swap/utils/swapAssetToDisplayable'
import { useStyles } from './styles'

export type SwapAssetPairIconProps = {
    assetIn: SwapIconAsset
    assetOut: SwapIconAsset
    surfaceColor: string
    /** Pins each leg's network to its icon; the source leg's only when the swap crosses chains. */
    isChainShown?: boolean
}

export const SwapAssetPairIcon = ({
    assetIn,
    assetOut,
    surfaceColor,
    isChainShown = false,
}: SwapAssetPairIconProps) => {
    const styles = useStyles({ surfaceColor })
    const isCrossChain = toScopeKey(assetIn.ref) !== toScopeKey(assetOut.ref)

    return (
        <PWView style={styles.container}>
            <PWView style={styles.assetInIcon}>
                <AssetIcon
                    chainId={assetIn.ref.chainId}
                    asset={swapAssetToDisplayable(assetIn)}
                    size='md'
                />
                {isChainShown && isCrossChain && (
                    <ChainAvatarBadge
                        chainId={assetIn.ref.chainId}
                        corner='left'
                    />
                )}
            </PWView>
            <PWView style={styles.assetOutIcon}>
                <AssetIcon
                    chainId={assetOut.ref.chainId}
                    asset={swapAssetToDisplayable(assetOut)}
                    size='md'
                />
                {isChainShown && (
                    <ChainAvatarBadge chainId={assetOut.ref.chainId} />
                )}
            </PWView>
        </PWView>
    )
}
