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

import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { TransactionDetailLayout } from '@modules/signing'
import { TransactionDisplay } from '../TransactionDisplay'
import { TransactionWarnings } from '../TransactionWarnings/TransactionWarnings'
import { TransactionFooter } from '../transaction-details/TransactionFooter/TransactionFooter'
import { useTransactionFooter } from '../transaction-details/TransactionFooter/useTransactionFooter'
import { useAlgorandTransactionDetailLayout } from './useAlgorandTransactionDetailLayout'

type AlgorandTransactionDetailLayoutProps = {
    transaction: AlgorandTransactionView
    onInnerTransactionsPress?: (tx: AlgorandTransactionView) => void
}

export const AlgorandTransactionDetailLayout = ({
    transaction,
    onInnerTransactionsPress,
}: AlgorandTransactionDetailLayoutProps) => {
    const summary = useAlgorandTransactionDetailLayout(transaction)
    const { hasActions } = useTransactionFooter(transaction)

    return (
        <TransactionDetailLayout
            summary={summary}
            isHeroShown={summary.status !== undefined}
            warnings={
                summary.status === 'pending' ? (
                    <TransactionWarnings transaction={transaction} />
                ) : undefined
            }
            chainSection={
                <TransactionDisplay
                    transaction={transaction}
                    onInnerTransactionsPress={onInnerTransactionsPress}
                />
            }
            actions={
                hasActions ? (
                    <TransactionFooter transaction={transaction} />
                ) : undefined
            }
        />
    )
}
