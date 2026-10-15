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

import { PWView } from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { TransactionPreview } from '../TransactionPreview'
import {
    useGroupTransactionsPanel,
    type GroupTransactionsPanelProps,
} from './useGroupTransactionsPanel'

export type { GroupTransactionsPanelProps }

export const GroupTransactionsPanel = (props: GroupTransactionsPanelProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { otherTransactions, groupSize, handlePress } =
        useGroupTransactionsPanel(props)

    if (groupSize <= 1 || otherTransactions.length === 0) {
        return null
    }

    return (
        <TitledExpandablePanel
            title={t('transactions.group_transactions', {
                count: groupSize,
            })}
        >
            <PWView style={styles.container}>
                {otherTransactions.map((tx, index) => (
                    <TransactionPreview
                        onPress={handlePress}
                        key={tx.id ?? index}
                        transaction={tx}
                    />
                ))}
            </PWView>
        </TitledExpandablePanel>
    )
}
