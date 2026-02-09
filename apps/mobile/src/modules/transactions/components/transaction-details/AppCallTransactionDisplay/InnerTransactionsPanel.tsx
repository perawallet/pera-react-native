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

import { PWView } from '@components/core'
import { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { TransactionPreview } from '../TransactionPreview'

export type InnerTransactionsPanelProps = {
    innerTransactions: PeraDisplayableTransaction[]
    onInnerTransactionPress?: (tx: PeraDisplayableTransaction) => void
}

export const InnerTransactionsPanel = ({
    innerTransactions,
    onInnerTransactionPress,
}: InnerTransactionsPanelProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    if (!innerTransactions.length) {
        return null
    }

    return (
        <TitledExpandablePanel
            title={t('transactions.app_call.inner_transactions', {
                count: innerTransactions.length,
            })}
        >
            <PWView style={styles.expandablePanel}>
                {innerTransactions.map((tx, index) => (
                    <TransactionPreview
                        onPress={onInnerTransactionPress}
                        key={tx.id ?? index}
                        transaction={tx}
                    />
                ))}
            </PWView>
        </TitledExpandablePanel>
    )
}
