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

import type {
    SuspectedPoisoning,
    TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import type { TransactionListRow } from '../../utils/transactionListRows'
import { TransactionDateHeader } from '../TransactionDateHeader'
import { TransactionListItem } from '../TransactionListItem'

export type TransactionHistoryRowProps = {
    row: TransactionListRow
    onTransactionPress?: (transaction: TransactionHistoryItem) => void
    suspectedPoisoning?: SuspectedPoisoning
}

export const TransactionHistoryRow = ({
    row,
    onTransactionPress,
    suspectedPoisoning,
}: TransactionHistoryRowProps) => {
    switch (row.kind) {
        case 'header': {
            return <TransactionDateHeader title={row.title} />
        }
        case 'record': {
            return (
                <TransactionListItem
                    record={row.record}
                    suspectedPoisoning={suspectedPoisoning}
                    networkChainId={row.networkChainId}
                />
            )
        }
        case 'transaction': {
            return (
                <TransactionListItem
                    transaction={row.transaction}
                    onPress={onTransactionPress}
                    suspectedPoisoning={suspectedPoisoning}
                    networkChainId={row.networkChainId}
                />
            )
        }
        default: {
            const exhaustive: never = row
            return exhaustive
        }
    }
}
