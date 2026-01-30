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

import { EmptyView } from '@components/EmptyView'
import {
    getTransactionType,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import {
    PaymentTransactionDisplay,
    AssetTransferDisplay,
    AssetConfigDisplay,
    AssetFreezeDisplay,
    KeyRegistrationDisplay,
    AppCallTransactionDisplay,
} from '../transaction-details'

export type TransactionDisplayProps = {
    transaction: PeraDisplayableTransaction
    isInnerTransaction?: boolean
    onInnerTransactionsPress?: (tx: PeraDisplayableTransaction) => void
}

export const TransactionDisplay = ({
    transaction,
    isInnerTransaction = false,
    onInnerTransactionsPress,
}: TransactionDisplayProps) => {
    const { t } = useLanguage()
    const txType = getTransactionType(transaction)

    switch (txType) {
        case 'payment':
            return (
                <PaymentTransactionDisplay
                    transaction={transaction}
                    isInnerTransaction={isInnerTransaction}
                />
            )

        case 'asset-transfer':
            return (
                <AssetTransferDisplay
                    transaction={transaction}
                    isInnerTransaction={isInnerTransaction}
                />
            )

        case 'asset-config':
            return (
                <AssetConfigDisplay
                    transaction={transaction}
                    isInnerTransaction={isInnerTransaction}
                />
            )

        case 'asset-freeze':
            return (
                <AssetFreezeDisplay
                    transaction={transaction}
                    isInnerTransaction={isInnerTransaction}
                />
            )

        case 'key-registration':
            return (
                <KeyRegistrationDisplay
                    transaction={transaction}
                    isInnerTransaction={isInnerTransaction}
                />
            )

        case 'app-call':
            return (
                <AppCallTransactionDisplay
                    transaction={transaction}
                    isInnerTransaction={isInnerTransaction}
                    onInnerTransactionsPress={onInnerTransactionsPress}
                />
            )

        case 'state-proof':
        case 'heartbeat':
        case 'unknown':
        default:
            return (
                <EmptyView
                    title={t('transactions.unknown.title')}
                    body={t('transactions.unknown.body')}
                />
            )
    }
}
