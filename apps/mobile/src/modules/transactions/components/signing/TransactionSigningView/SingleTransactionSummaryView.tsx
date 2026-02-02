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
    getTransactionType,
    microAlgosToAlgos,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useTheme } from '@rneui/themed'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'
import { TransactionWarnings } from '../../TransactionWarnings'

export type SingleTransactionSummaryViewProps = {
    transaction: PeraDisplayableTransaction
    fee: bigint
    onViewDetails: () => void
}

export const SingleTransactionSummaryView = ({
    transaction,
    fee,
    onViewDetails,
}: SingleTransactionSummaryViewProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const txType = getTransactionType(transaction)
    const showWarnings = !transaction?.id

    return (
        <PWView style={styles.summaryContainer}>
            <PWView style={styles.summaryHeader}>
                <TransactionIcon
                    type={txType}
                    size='lg'
                />
                <PWText variant='h3'>
                    {t(`transactions.type.${transaction.txType}`)}
                </PWText>
            </PWView>

            <PWDivider color={theme.colors.layerGray} />

            <PWTouchableOpacity
                onPress={onViewDetails}
                style={styles.viewDetailsRow}
            >
                <PWText style={styles.viewDetailsLabel}>
                    {t('signing.view_details')}
                </PWText>
                <PWIcon
                    name='chevron-right'
                    size='sm'
                />
            </PWTouchableOpacity>

            <PWDivider color={theme.colors.layerGray} />

            <PWView style={styles.feeRow}>
                <PWText style={styles.feeLabel}>
                    {t('transactions.common.fee')}
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

            {showWarnings && <TransactionWarnings transaction={transaction} />}
        </PWView>
    )
}
