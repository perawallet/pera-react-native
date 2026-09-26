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

import { useCallback, useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { useTheme } from '@rneui/themed'
import type { TopPairItem } from '@perawallet/wallet-core-swaps'
import { formatCurrency } from '@perawallet/wallet-core-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { UNKNOWN_AMOUNT_PLACEHOLDER } from '@constants/ui'
import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { SwapAssetPairIcon } from '@modules/swap/components/SwapAssetPairIcon'
import { useStyles } from './styles'

export type SwapTopPairItemProps = {
    index: number
    pair: TopPairItem
    onPress: (pair: TopPairItem) => void
}

export const SwapTopPairItem = ({
    index,
    pair,
    onPress,
}: SwapTopPairItemProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { preferredCurrency, usdToPreferred } = useCurrency()

    const handlePress = useCallback(() => {
        onPress(pair)
    }, [onPress, pair])

    const volumeDisplay = useMemo(() => {
        const volume = usdToPreferred(new Decimal(pair.volume24hUsd))
        if (!volume) return UNKNOWN_AMOUNT_PLACEHOLDER
        return formatCurrency(
            volume,
            1,
            preferredCurrency,
            undefined,
            true,
            true,
        )
    }, [pair.volume24hUsd, usdToPreferred, preferredCurrency])

    const pairLabel = `${pair.assetA.unitName ?? ''} to ${pair.assetB.unitName ?? ''}`

    return (
        <PWTouchableOpacity
            style={styles.itemContainer}
            onPress={handlePress}
            testID={`swap-top-pair-${index}`}
        >
            <PWText
                variant='body'
                style={styles.itemIndex}
            >
                {index}
            </PWText>
            <SwapAssetPairIcon
                assetIn={pair.assetA}
                assetOut={pair.assetB}
                surfaceColor={theme.colors.background}
            />
            <PWView style={styles.itemLabelContainer}>
                <PWText
                    variant='body'
                    truncate
                >
                    {pairLabel}
                </PWText>
            </PWView>
            <PWText
                variant='body'
                style={styles.itemVolume}
                numberOfLines={1}
            >
                {volumeDisplay}
            </PWText>
        </PWTouchableOpacity>
    )
}
