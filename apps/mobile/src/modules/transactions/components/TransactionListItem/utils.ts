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

import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import {
    getTransactionType,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionIconType } from '@modules/transactions/components/TransactionIcon'

/**
 * Determines the icon type for a transaction based on its type and direction.
 */
export const getTransactionIconType = (
    transaction: TransactionHistoryItem,
    isOutgoing: boolean,
): TransactionIconType => {
    // Swap transactions
    if (transaction.swapGroupDetail) return 'swap'

    // Asset transfers: check subtypes
    if (transaction.txType === 'axfer') {
        // Opt-in: self-transfer with zero amount, no close-to
        if (
            transaction.sender === transaction.receiver &&
            transaction.amount !== null &&
            transaction.amount.isZero() &&
            !transaction.closeTo
        ) {
            return 'asset-opt-in'
        }

        // Opt-out: has closeTo address
        if (transaction.closeTo) {
            return 'asset-opt-out'
        }

        // Regular asset transfer
        return isOutgoing ? 'send' : 'receive'
    }

    // Payment transactions
    if (transaction.txType === 'pay') {
        return isOutgoing ? 'send' : 'receive'
    }

    // All other types (app-call, asset-config, etc.)
    return getTransactionType(
        transaction as unknown as PeraDisplayableTransaction,
    )
}
