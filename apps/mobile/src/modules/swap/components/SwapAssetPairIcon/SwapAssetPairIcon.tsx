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

import { PWView } from '@components/core'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { dexSwapAssetToDisplayable } from '@modules/swap/utils/dexSwapAssetToDisplayable'
import type { DexSwapAsset } from '@perawallet/wallet-core-swaps'
import { useStyles } from './styles'

export type SwapAssetPairIconProps = {
    assetIn: DexSwapAsset
    assetOut: DexSwapAsset
    surfaceColor: string
}

export const SwapAssetPairIcon = ({
    assetIn,
    assetOut,
    surfaceColor,
}: SwapAssetPairIconProps) => {
    const styles = useStyles({ surfaceColor })

    return (
        <PWView style={styles.container}>
            <AssetIcon
                asset={dexSwapAssetToDisplayable(assetIn)}
                size='md'
                style={styles.assetInIcon}
            />
            <PWView style={styles.assetOutIcon}>
                <AssetIcon
                    asset={dexSwapAssetToDisplayable(assetOut)}
                    size='md'
                />
            </PWView>
        </PWView>
    )
}
