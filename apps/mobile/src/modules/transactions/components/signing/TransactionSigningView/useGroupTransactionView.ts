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
import type {
    TransactionSignRequest,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'

const getInnerTransactions = (tx: PeraTransaction): PeraTransaction[] => {
    if (tx.appCall?.innerTransactions) {
        return tx.appCall.innerTransactions as PeraTransaction[]
    }
    return []
}

type UseGroupTransactionViewParams = {
    request: TransactionSignRequest
}

type UseGroupTransactionViewResult = {
    isMultipleGroups: boolean
    allTransactions: PeraTransaction[]
    selectedTx: PeraTransaction | null
    currentTx: PeraTransaction | null
    innerTransactions: PeraTransaction[]
    isViewingTransaction: boolean
    handleSelectTransaction: (index: number) => void
    handleNavigateToInner: (tx: PeraTransaction) => void
    handleNavigateBack: () => void
}

export const useGroupTransactionView = ({
    request,
}: UseGroupTransactionViewParams): UseGroupTransactionViewResult => {
    const [selectedTxIndex, setSelectedTxIndex] = useState<number | null>(null)

    // Stack-based navigation for recursive inner transaction drill-down
    const [innerTransactionStack, setInnerTransactionStack] = useState<
        PeraTransaction[]
    >([])

    const isMultipleGroups = request.txs?.length > 1
    const allTransactions = useMemo(() => request.txs.flat(), [request.txs])

    const selectedTx = useMemo(() => {
        return selectedTxIndex !== null
            ? allTransactions[selectedTxIndex]
            : null
    }, [selectedTxIndex, allTransactions])

    // Current transaction being viewed - either an inner tx from the stack, or the selected group tx
    const currentTx = useMemo(() => {
        return innerTransactionStack.length > 0
            ? innerTransactionStack[innerTransactionStack.length - 1]
            : selectedTx
    }, [innerTransactionStack, selectedTx])

    // Get inner transactions for the current transaction
    const innerTransactions = useMemo(() => {
        return currentTx ? getInnerTransactions(currentTx) : []
    }, [currentTx])

    const isViewingTransaction = selectedTx !== null

    const handleSelectTransaction = useCallback((index: number) => {
        setSelectedTxIndex(index)
        setInnerTransactionStack([])
    }, [])

    const handleNavigateBack = useCallback(() => {
        if (innerTransactionStack.length > 0) {
            // Navigate back through inner transaction stack
            setInnerTransactionStack(prev => prev.slice(0, -1))
        } else {
            // Return to group list
            setSelectedTxIndex(null)
        }
    }, [innerTransactionStack.length])

    const handleNavigateToInner = useCallback((tx: PeraTransaction) => {
        setInnerTransactionStack(prev => [...prev, tx])
    }, [])

    return {
        isMultipleGroups,
        allTransactions,
        selectedTx,
        currentTx,
        innerTransactions,
        isViewingTransaction,
        handleSelectTransaction,
        handleNavigateToInner,
        handleNavigateBack,
    }
}
