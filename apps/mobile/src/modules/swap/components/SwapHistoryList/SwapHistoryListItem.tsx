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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SwapAssetPairIcon } from '@modules/swap/components/SwapAssetPairIcon'
import type { SwapHistoryItem } from '@perawallet/wallet-core-swaps'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-blockchain'
import {
    DEFAULT_PRECISION,
    formatDatetime,
    formatNumber,
} from '@perawallet/wallet-core-shared'
import { useTheme } from '@rneui/themed'
import { useStyles } from './styles'

export type SwapHistoryListItemProps = {
    item: SwapHistoryItem
    onPress: (item: SwapHistoryItem) => void
}

const formatAmount = (
    amountBaseUnits: SwapHistoryItem['amountIn'],
    decimals: number,
): string => {
    const display = baseUnitsToDisplayUnits(amountBaseUnits, decimals)
    const { sign, integer, fraction } = formatNumber(
        display,
        decimals,
        undefined,
        DEFAULT_PRECISION,
    )
    return `${sign}${integer}${fraction}`
}

export const SwapHistoryListItem = ({
    item,
    onPress,
}: SwapHistoryListItemProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const inDecimals = item.assetIn.decimals ?? 0
    const outDecimals = item.assetOut.decimals ?? 0
    const inUnit = item.assetIn.unitName ?? ''
    const outUnit = item.assetOut.unitName ?? ''

    const descriptionPrefix = t('swap.history.list.item.description', {
        amountIn: formatAmount(item.amountIn, inDecimals),
        unitIn: inUnit,
    })
    const amountOutLabel = `${formatAmount(item.amountOut, outDecimals)} ${outUnit}`
    const dateLabel = item.completedDatetime
        ? formatDatetime(item.completedDatetime, undefined, 'medium')
        : ''

    return (
        <PWTouchableOpacity
            style={styles.item}
            onPress={() => onPress(item)}
            testID={`swap-history-item-${item.id}`}
        >
            <SwapAssetPairIcon
                assetIn={item.assetIn}
                assetOut={item.assetOut}
                surfaceColor={theme.colors.background}
            />
            <PWView style={styles.itemBody}>
                <PWText
                    variant='body'
                    style={styles.itemDescription}
                >
                    {descriptionPrefix}
                    <PWText variant='bodySemibold'>{amountOutLabel}</PWText>
                    {!!dateLabel && (
                        <PWText
                            variant='body'
                            style={styles.itemDate}
                        >
                            {` · ${dateLabel}`}
                        </PWText>
                    )}
                </PWText>
            </PWView>
            <PWIcon
                name='arrow-up-right'
                size='sm'
            />
        </PWTouchableOpacity>
    )
}
