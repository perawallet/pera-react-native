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

import { useCallback, useMemo } from 'react'
import {
    readAlgorandNative,
    useGroupTransactionsQuery,
    type AlgorandTransactionView,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import type { RelatedTransactionsProps } from '@modules/signing'
import {
    toGroupTransactionRows,
    type GroupTransactionRow,
} from '@modules/algorand/utils/groupTransactionRows'

export type GroupTransactionsPanelProps = RelatedTransactionsProps

type UseGroupTransactionsPanelResult = {
    otherTransactions: GroupTransactionRow[]
    groupSize: number
    handlePress: (view: AlgorandTransactionView) => void
}

export const useGroupTransactionsPanel = ({
    groupId,
    currentTransaction,
    onRelatedTransactionPress,
}: GroupTransactionsPanelProps): UseGroupTransactionsPanelResult => {
    const { groupTransactions } = useGroupTransactionsQuery({ groupId })
    const currentId = readAlgorandNative(currentTransaction)?.id ?? ''

    const otherTransactions = useMemo(
        () =>
            toGroupTransactionRows(groupTransactions).filter(
                ({ view }) => view.id !== currentId,
            ),
        [groupTransactions, currentId],
    )

    const handlePress = useCallback(
        (view: AlgorandTransactionView) => {
            const row = otherTransactions.find(other => other.view === view)
            if (row) {
                onRelatedTransactionPress(row.native)
            }
        },
        [otherTransactions, onRelatedTransactionPress],
    )

    return {
        otherTransactions,
        groupSize: groupTransactions.length,
        handlePress,
    }
}
