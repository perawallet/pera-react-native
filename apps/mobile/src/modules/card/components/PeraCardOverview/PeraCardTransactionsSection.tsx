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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CardTransactionListItem } from '../CardTransactionListItem'
import type { CardTransactionSection } from '../../utils/cardTransactions'
import { useStyles } from './styles'

type PeraCardTransactionsSectionProps = {
    sections: CardTransactionSection[]
    isLoading: boolean
    onShowAll: () => void
    onPressTransaction: (id: string) => void
}

export const PeraCardTransactionsSection = ({
    sections,
    isLoading,
    onShowAll,
    onPressTransaction,
}: PeraCardTransactionsSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.section}>
            <PWView style={styles.sectionHeader}>
                <PWText variant='h4'>
                    {t('peraCard.account.transactions_title')}
                </PWText>
                <PWTouchableOpacity
                    onPress={onShowAll}
                    testID='pera_card_show_all_transactions'
                >
                    <PWText variant='link'>
                        {t('peraCard.account.show_all')}
                    </PWText>
                </PWTouchableOpacity>
            </PWView>

            {isLoading ? null : sections.length === 0 ? (
                <PWText
                    variant='body'
                    style={styles.sectionDescription}
                >
                    {t('peraCard.account.transactions_empty')}
                </PWText>
            ) : (
                sections.map(section => (
                    <PWView key={section.key}>
                        <PWText
                            variant='footnoteMedium'
                            style={styles.monthHeader}
                        >
                            {section.title}
                        </PWText>
                        {section.data.map(transaction => (
                            <CardTransactionListItem
                                key={transaction.id}
                                transaction={transaction}
                                onPress={onPressTransaction}
                            />
                        ))}
                    </PWView>
                ))
            )}
        </PWView>
    )
}
