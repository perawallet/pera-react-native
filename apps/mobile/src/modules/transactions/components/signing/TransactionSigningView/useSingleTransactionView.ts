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

import { useState, useCallback, useMemo } from 'react'
import {
    type TransactionSignRequest,
    mapToDisplayableTransaction,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'

const getInnerTransactions = (
    tx: PeraDisplayableTransaction,
): PeraDisplayableTransaction[] => {
    if (tx.innerTxns) {
        return tx.innerTxns as PeraDisplayableTransaction[]
    }
    return []
}

type UseSingleTransactionViewParams = {
    request: TransactionSignRequest
}

type UseSingleTransactionViewResult = {
    rootTx: PeraDisplayableTransaction | null
    currentTx: PeraDisplayableTransaction | null
    innerTransactions: PeraDisplayableTransaction[]
    isViewingInnerTransaction: boolean
    handleNavigateToInner: (tx: PeraDisplayableTransaction) => void
    handleNavigateBack: () => void
}

export const useSingleTransactionView = ({
    request,
}: UseSingleTransactionViewParams): UseSingleTransactionViewResult => {
    // Stack-based navigation for recursive inner transaction drill-down
    // Stack[0] is the root transaction, subsequent entries are inner transactions
    const [transactionStack, setTransactionStack] = useState<
        PeraDisplayableTransaction[]
    >([])

    const rootTx = useMemo(() => {
        const tx = request.txs?.at(0)?.at(0)
        return tx ? mapToDisplayableTransaction(tx) : null
    }, [request.txs])

    // Current transaction is the last in the stack, or root if stack is empty
    const currentTx = useMemo(() => {
        const tx =
            transactionStack.length > 0
                ? transactionStack[transactionStack.length - 1]
                : rootTx

        if (!tx) {
            return null
        }

        return tx
    }, [transactionStack, rootTx])

    // Get inner transactions for the current transaction
    const innerTransactions = useMemo(() => {
        return currentTx ? getInnerTransactions(currentTx) : []
    }, [currentTx])

    const isViewingInnerTransaction = transactionStack.length > 0

    const handleNavigateToInner = useCallback(
        (tx: PeraDisplayableTransaction) => {
            setTransactionStack(prev => [...prev, tx])
        },
        [],
    )

    const handleNavigateBack = useCallback(() => {
        setTransactionStack(prev => prev.slice(0, -1))
    }, [])

    return {
        rootTx,
        currentTx,
        innerTransactions,
        isViewingInnerTransaction,
        handleNavigateToInner,
        handleNavigateBack,
    }
}
