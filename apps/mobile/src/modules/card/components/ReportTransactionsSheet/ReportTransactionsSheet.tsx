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

import { Fragment } from 'react'
import {
    PWButton,
    PWCheckbox,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ListItemDivider } from '@components/ListItemDivider'
import { useLanguage } from '@hooks/useLanguage'
import { CardTransactionListItem } from '../CardTransactionListItem'
import { useReportTransactionsSheet } from './useReportTransactionsSheet'
import { useStyles } from './styles'

/** Multi-select over recent transactions; reporting opens a support email. */
export const ReportTransactionsSheet = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        transactions,
        isLoading,
        isSelected,
        onToggle,
        canReport,
        onReport,
    } = useReportTransactionsSheet()

    return (
        <PWSheetLayout
            header={
                <PWView style={styles.header}>
                    <PWText variant='h2'>
                        {t(
                            'peraCard.transactions.report_transactions_sheet_title',
                        )}
                    </PWText>
                    <PWText
                        variant='body'
                        weight={400}
                        style={styles.subtitle}
                    >
                        {t(
                            'peraCard.transactions.report_transactions_sheet_subtitle',
                        )}
                    </PWText>
                </PWView>
            }
            footer={
                <PWButton
                    variant='primary'
                    title={t(
                        'peraCard.transactions.report_transactions_button',
                    )}
                    onPress={onReport}
                    isDisabled={!canReport}
                    testID='card_report_transactions_button'
                />
            }
            testID='card_report_transactions_sheet'
        >
            <PWText
                variant='footnoteMedium'
                weight={400}
                style={styles.recentLabel}
            >
                {t('peraCard.transactions.report_transactions_recent_label')}
            </PWText>

            {!isLoading && transactions.length === 0 ? (
                <PWText
                    variant='body'
                    weight={400}
                    style={styles.subtitle}
                >
                    {t('peraCard.account.transactions_empty')}
                </PWText>
            ) : (
                transactions.map((transaction, index) => (
                    <Fragment key={transaction.id}>
                        {index > 0 ? <ListItemDivider /> : null}
                        <PWTouchableOpacity
                            style={styles.row}
                            onPress={() => onToggle(transaction.id)}
                            testID={`card_report_tx_${transaction.id}`}
                        >
                            <PWCheckbox
                                checked={isSelected(transaction.id)}
                                onPress={() => onToggle(transaction.id)}
                                testID={`card_report_tx_checkbox_${transaction.id}`}
                            />
                            <PWView style={styles.rowItem}>
                                <CardTransactionListItem
                                    transaction={transaction}
                                />
                            </PWView>
                        </PWTouchableOpacity>
                    </Fragment>
                ))
            )}
        </PWSheetLayout>
    )
}
