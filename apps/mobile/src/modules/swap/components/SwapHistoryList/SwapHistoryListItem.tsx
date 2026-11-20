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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { Trans } from 'react-i18next'
import { useLanguage } from '@hooks/useLanguage'
import { SwapAssetPairIcon } from '@modules/swap/components/SwapAssetPairIcon'
import {
    DEFAULT_PRECISION,
    formatDatetime,
    formatNumber,
    baseUnitsToDisplayUnits,
} from '@perawallet/wallet-core-shared'
import { useTheme } from '@rneui/themed'
import { swapHistoryStatusKey } from '../../utils/swapHistoryStatusKey'
import type { ListedSwapHistoryItem } from './useSwapHistoryList'
import { useStyles } from './styles'

export type SwapHistoryListItemProps = {
    item: ListedSwapHistoryItem
    onPress: (item: ListedSwapHistoryItem) => void
}

const formatAmount = (
    amountBaseUnits: ListedSwapHistoryItem['amountIn'],
    decimals: number,
): string => {
    if (!amountBaseUnits) return '-'
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

    const amountInLabel = `${formatAmount(item.amountIn, inDecimals)} ${inUnit}`
    const amountOutLabel = `${formatAmount(item.amountOut, outDecimals)} ${outUnit}`
    const isCompleted = item.status === 'completed'
    const statusKey = swapHistoryStatusKey(item.status)
    const statusLabel = statusKey ? t(statusKey) : ''
    // A completed order is last updated when it completes.
    const trailingLabel = isCompleted
        ? formatDatetime(item.updatedAt, undefined, 'medium')
        : statusLabel

    return (
        <PWTouchableOpacity
            style={styles.item}
            onPress={() => onPress(item)}
            disabled={!item.explorerUrl}
            testID={`swap-history-item-${item.orderId}`}
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
                    <Trans
                        t={t}
                        i18nKey={
                            isCompleted
                                ? 'swap.history.list.item.description'
                                : 'swap.history.list.item.description_unsettled'
                        }
                        components={[
                            <PWText key='amount-in'>{amountInLabel}</PWText>,
                            <PWText
                                key='amount-out'
                                variant='bodySemibold'
                            >
                                {amountOutLabel}
                            </PWText>,
                        ]}
                    />
                    {!!trailingLabel && (
                        <PWText
                            variant='body'
                            style={styles.itemDate}
                        >
                            {` · ${trailingLabel}`}
                        </PWText>
                    )}
                </PWText>
            </PWView>
            {!!item.explorerUrl && (
                <PWIcon
                    name='arrow-up-right'
                    size='sm'
                />
            )}
        </PWTouchableOpacity>
    )
}
