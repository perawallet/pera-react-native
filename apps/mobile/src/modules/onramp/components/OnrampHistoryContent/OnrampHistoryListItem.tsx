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
import { useLanguage } from '@hooks/useLanguage'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import type { RampHistoryItem } from '@perawallet/wallet-core-onramp'
import { useTheme } from '@rneui/themed'
import { OnrampAssetPairIcon } from '../OnrampAssetPairIcon'
import { OnrampOrderStatus } from '../OnrampOrderStatus'
import { useItemStyles } from './styles'

export type OnrampHistoryListItemProps = {
    item: RampHistoryItem
    onPress: (item: RampHistoryItem) => void
}

const formatAmount = (
    amount: RampHistoryItem['sourceAmount'],
    currencyCode: string | null,
    fallbackSymbol: string,
): string | null => {
    if (amount === null) return null
    return `${amount.toString()} ${currencyCode ?? fallbackSymbol}`
}

export const OnrampHistoryListItem = ({
    item,
    onPress,
}: OnrampHistoryListItemProps) => {
    const { theme } = useTheme()
    const { t } = useLanguage()

    const sourceSymbol = item.pair.sourceToken.symbol
    const destinationSymbol = item.pair.destinationToken.symbol

    const sourceAmountLabel = formatAmount(
        item.sourceAmount,
        item.sourceCurrencyCode,
        sourceSymbol,
    )
    const destinationAmountLabel = formatAmount(
        item.destinationAmount,
        item.destinationCurrencyCode,
        destinationSymbol,
    )

    const styles = useItemStyles()

    const dateLabel = formatDatetime(item.creationDatetime, undefined, 'medium')

    return (
        <PWTouchableOpacity
            style={styles.item}
            onPress={() => onPress(item)}
            testID={`onramp-history-item-${item.id}`}
        >
            {item.status === 'pending' && (
                <PWView
                    style={styles.pendingDot}
                    testID={`onramp-history-pending-dot-${item.id}`}
                />
            )}
            <OnrampAssetPairIcon
                sourceToken={item.pair.sourceToken}
                destinationToken={item.pair.destinationToken}
                surfaceColor={theme.colors.background}
            />

            <PWView style={styles.itemBody}>
                <PWText
                    variant='bodySemibold'
                    truncate
                >
                    {sourceAmountLabel ?? sourceSymbol}
                    <PWText variant='body'>{` ${t('onramp.history.for')} `}</PWText>
                    {destinationAmountLabel ?? destinationSymbol}
                </PWText>

                <PWView style={styles.itemStatusRow}>
                    <OnrampOrderStatus
                        status={item.status}
                        textVariant='caption'
                    />
                    {!!dateLabel && (
                        <PWText
                            variant='caption'
                            style={styles.itemDate}
                        >
                            {` · ${dateLabel}`}
                        </PWText>
                    )}
                </PWView>
            </PWView>

            <PWIcon
                name='chevron-right'
                size='sm'
                variant='secondary'
            />
        </PWTouchableOpacity>
    )
}
