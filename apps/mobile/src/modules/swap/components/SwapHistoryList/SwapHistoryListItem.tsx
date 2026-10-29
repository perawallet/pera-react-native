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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { Trans } from 'react-i18next'
import { useLanguage } from '@hooks/useLanguage'
import { SwapAssetPairIcon } from '@modules/swap/components/SwapAssetPairIcon'
import type { SwapHistoryItem } from '@perawallet/wallet-core-swaps'
import {
    DEFAULT_PRECISION,
    formatDatetime,
    formatNumber,
    baseUnitsToDisplayUnits,
} from '@perawallet/wallet-core-shared'
import { useTheme } from '@rneui/themed'
import { useStyles } from './styles'

export type SwapHistoryListItemProps = {
    item: SwapHistoryItem
    chainId: ChainId
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
    chainId,
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
                chainId={chainId}
                surfaceColor={theme.colors.background}
            />
            <PWView style={styles.itemBody}>
                <PWText
                    variant='body'
                    style={styles.itemDescription}
                >
                    <Trans
                        t={t}
                        i18nKey='swap.history.list.item.description'
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
