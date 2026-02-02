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

import { PWIcon, PWText, PWToolbar, PWTouchableOpacity, PWView } from '@components/core'
import { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionDisplay } from '../../TransactionDisplay'

export type TransactionDetailsViewProps = {
    transaction: PeraDisplayableTransaction
    onBack: () => void
    onInnerTransactionPress: (tx: PeraDisplayableTransaction) => void
}

export const TransactionDetailsView = ({
    transaction,
    onBack,
    onInnerTransactionPress,
}: TransactionDetailsViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.detailsViewContainer}>
            <PWToolbar
                center={<PWText variant='h4'>{t('signing.transactions.details')}</PWText>}
                left={
                    <PWTouchableOpacity
                        onPress={onBack}
                        style={styles.backButtonRow}
                    >
                        <PWIcon
                            name='chevron-left'
                            size='sm'
                        />
                    </PWTouchableOpacity>
                }
            />

            <TransactionDisplay
                transaction={transaction}
                onInnerTransactionsPress={onInnerTransactionPress}
            />
        </PWView>
    )
}
