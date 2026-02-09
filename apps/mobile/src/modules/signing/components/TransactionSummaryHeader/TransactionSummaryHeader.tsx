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

import { PWText, PWToolbar, PWView } from '@components/core'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import {
    getTransactionType,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { PaymentSummaryHeader } from './PaymentSummaryHeader'
import { AssetTransferSummaryHeader } from './AssetTransferSummaryHeader'
import { AppCallSummaryHeader } from './AppCallSummaryHeader'
import { GenericSummaryHeader } from './GenericSummaryHeader'

export type TransactionSummaryHeaderProps = {
    transaction: PeraDisplayableTransaction
    title?: string
}

export const TransactionSummaryHeader = ({
    transaction,
    title,
}: TransactionSummaryHeaderProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const txType = getTransactionType(transaction)

    return (
        <>
            <PWToolbar
                center={
                    <PWText
                        variant='h4'
                        style={styles.title}
                    >
                        {title ?? t('signing.transactions.title', { count: 1 })}
                    </PWText>
                }
            />
            <PWView style={styles.container}>
                <TransactionIcon
                    type={txType}
                    size='lg'
                />

                {txType === 'payment' && (
                    <PaymentSummaryHeader transaction={transaction} />
                )}
                {(txType === 'asset-transfer' ||
                    txType === 'asset-opt-in' ||
                    txType === 'asset-opt-out' ||
                    txType === 'asset-clawback') && (
                    <AssetTransferSummaryHeader transaction={transaction} />
                )}
                {txType === 'app-call' && (
                    <AppCallSummaryHeader transaction={transaction} />
                )}
                {(txType === 'key-registration' ||
                    txType === 'asset-config' ||
                    txType === 'heartbeat' ||
                    txType === 'state-proof' ||
                    txType === 'unknown') && (
                    <GenericSummaryHeader transaction={transaction} />
                )}
            </PWView>
        </>
    )
}
