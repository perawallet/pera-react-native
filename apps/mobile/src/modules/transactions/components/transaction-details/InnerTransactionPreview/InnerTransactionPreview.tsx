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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import {
    encodeAlgorandAddress,
    getTransactionType,
    microAlgosToAlgos,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import type { TransactionIconType } from '@modules/transactions/components/TransactionIcon/TransactionIcon'

export type InnerTransactionPreviewProps = {
    transaction: PeraTransaction
    onPress?: () => void
}

const getTransactionIconType = (tx: PeraTransaction): TransactionIconType => {
    const txType = getTransactionType(tx)
    return txType === 'unknown' ? 'payment' : txType
}

const getInnerTransactionCount = (tx: PeraTransaction): number => {
    // Check if this transaction has nested inner transactions
    // Inner transactions are typically found in app call results
    if (tx.appCall?.innerTransactions) {
        return tx.appCall.innerTransactions.length
    }
    return 0
}

const getAmountDisplay = (
    tx: PeraTransaction,
    t: (key: string, options?: Record<string, unknown>) => string,
): string | null => {
    const txType = getTransactionType(tx)

    switch (txType) {
        case 'payment': {
            if (tx.payment) {
                const amount = microAlgosToAlgos(tx.payment.amount)
                return `${amount} ALGO`
            }
            return null
        }
        case 'asset-transfer': {
            if (tx.assetTransfer) {
                // Just show the raw amount for now - asset decimals would need asset lookup
                return `${tx.assetTransfer.amount}`
            }
            return null
        }
        case 'app-call': {
            const innerCount = getInnerTransactionCount(tx)
            if (innerCount > 0) {
                return t('signing.tx_display.inner_preview.inner_count', {
                    count: innerCount,
                })
            }
            return null
        }
        default:
            return null
    }
}

export const InnerTransactionPreview = ({
    transaction,
    onPress,
}: InnerTransactionPreviewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const senderAddress = encodeAlgorandAddress(transaction.sender.publicKey)
    const iconType = getTransactionIconType(transaction)
    const amountDisplay = getAmountDisplay(transaction, t)
    const txType = getTransactionType(transaction)

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
        >
            <TransactionIcon
                type={iconType}
                size='small'
            />
            <PWView style={styles.content}>
                <PWText style={styles.typeLabel}>{txType}</PWText>
                <PWText style={styles.address}>
                    {truncateAlgorandAddress(senderAddress)}
                </PWText>
            </PWView>
            <PWView style={styles.rightContent}>
                {amountDisplay && (
                    <PWText style={styles.amount}>{amountDisplay}</PWText>
                )}
                <PWIcon
                    name='chevron-right'
                    size='sm'
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
