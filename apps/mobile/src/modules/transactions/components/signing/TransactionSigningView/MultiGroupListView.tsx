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

import {
    PWDivider,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import {
    microAlgosToAlgos,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useTheme } from '@rneui/themed'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'

export type MultiGroupListViewProps = {
    groups: PeraDisplayableTransaction[][]
    fee: bigint
    onGroupPress: (groupIndex: number) => void
}

type GroupPreviewProps = {
    transactions: PeraDisplayableTransaction[]
    groupIndex: number
    onPress: () => void
}

const GroupPreview = ({
    transactions,
    groupIndex,
    onPress,
}: GroupPreviewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWTouchableOpacity
            style={styles.groupPreviewContainer}
            onPress={onPress}
        >
            <TransactionIcon
                type='group'
                size='sm'
            />
            <PWView style={styles.groupPreviewContent}>
                <PWText style={styles.groupPreviewTitle}>
                    {t('transactions.group.group_number', {
                        number: groupIndex + 1,
                    })}
                </PWText>
                <PWText
                    variant='caption'
                    style={styles.groupPreviewSubtitle}
                >
                    {t('transactions.group.transactions_count', {
                        count: transactions.length,
                    })}
                </PWText>
            </PWView>
            <PWIcon
                name='chevron-right'
                size='sm'
            />
        </PWTouchableOpacity>
    )
}

export const MultiGroupListView = ({
    groups,
    fee,
    onGroupPress,
}: MultiGroupListViewProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    return (
        <PWView style={styles.groupContainer}>
            <PWView style={styles.groupHeader}>
                <TransactionIcon
                    type='group'
                    size='lg'
                />
                <PWText variant='h3'>
                    {t('transactions.group.multiple_groups_title')}
                </PWText>
            </PWView>

            <PWDivider color={theme.colors.layerGray} />

            <PWView style={styles.groupList}>
                <PWText style={styles.transactionListHeaderText}>
                    {t('transactions.group.groups_count', {
                        count: groups.length,
                    })}
                </PWText>

                {groups.map((group, index) => (
                    <GroupPreview
                        key={`group-${index}`}
                        transactions={group}
                        groupIndex={index}
                        onPress={() => onGroupPress(index)}
                    />
                ))}
            </PWView>

            <PWDivider color={theme.colors.layerGray} />

            <PWView style={styles.feeRow}>
                <PWText style={styles.feeLabel}>
                    {t('transactions.common.total_fee')}
                </PWText>
                <CurrencyDisplay
                    currency='ALGO'
                    precision={6}
                    minPrecision={2}
                    value={Decimal(microAlgosToAlgos(fee))}
                    showSymbol
                    style={styles.feeValue}
                />
            </PWView>
        </PWView>
    )
}
