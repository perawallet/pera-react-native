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
    type PeraTransaction,
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
    transaction: PeraTransaction
    innerTransactions?: PeraTransaction[]
    onInnerTransactionPress?: (tx: PeraTransaction, index: number) => void
}

export const TransactionDisplay = ({
    transaction,
    innerTransactions,
    onInnerTransactionPress,
}: TransactionDisplayProps) => {
    const { t } = useLanguage()
    const txType = getTransactionType(transaction)

    switch (txType) {
        case 'payment':
            return <PaymentTransactionDisplay transaction={transaction} />

        case 'asset-transfer':
            return <AssetTransferDisplay transaction={transaction} />

        case 'asset-config':
            return <AssetConfigDisplay transaction={transaction} />

        case 'asset-freeze':
            return <AssetFreezeDisplay transaction={transaction} />

        case 'key-registration':
            return <KeyRegistrationDisplay transaction={transaction} />

        case 'app-call':
            return (
                <AppCallTransactionDisplay
                    transaction={transaction}
                    innerTransactions={innerTransactions}
                    onInnerTransactionPress={onInnerTransactionPress}
                />
            )

        case 'state-proof':
        case 'heartbeat':
        case 'unknown':
        default:
            return (
                <EmptyView
                    title={t('signing.tx_display.unknown.title')}
                    body={t('signing.tx_display.unknown.body')}
                />
            )
    }
}
