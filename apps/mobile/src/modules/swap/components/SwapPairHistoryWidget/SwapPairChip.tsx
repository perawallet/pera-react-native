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

import { PWText, PWTouchableOpacity } from '@components/core'
import type { DexSwapAsset } from '@perawallet/wallet-core-swaps'
import { SwapAssetPairIcon } from '@modules/swap/components/SwapAssetPairIcon'
import { useTheme } from '@rneui/themed'
import { useStyles } from './styles'

export type SwapPairChipProps = {
    assetIn: DexSwapAsset
    assetOut: DexSwapAsset
    onPress: () => void
}

export const SwapPairChip = ({
    assetIn,
    assetOut,
    onPress,
}: SwapPairChipProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const label = `${assetIn.unitName ?? ''} to ${assetOut.unitName ?? ''}`

    return (
        <PWTouchableOpacity
            style={styles.chip}
            onPress={onPress}
            testID={`swap-pair-chip-${assetIn.assetId}-${assetOut.assetId}`}
        >
            <SwapAssetPairIcon
                assetIn={assetIn}
                assetOut={assetOut}
                surfaceColor={theme.colors.layerGrayLightest}
            />
            <PWText variant='body'>{label}</PWText>
        </PWTouchableOpacity>
    )
}
