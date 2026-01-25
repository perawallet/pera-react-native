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

type UseSingleTransactionViewParams = {
    request: TransactionSignRequest
}

type UseSingleTransactionViewResult = {
    rootTx: PeraTransaction | undefined
    currentTx: PeraTransaction | undefined
    innerTransactions: PeraTransaction[]
    isViewingInnerTransaction: boolean
    handleNavigateToInner: (tx: PeraTransaction) => void
    handleNavigateBack: () => void
}

export const useSingleTransactionView = ({
    request,
}: UseSingleTransactionViewParams): UseSingleTransactionViewResult => {
    // Stack-based navigation for recursive inner transaction drill-down
    // Stack[0] is the root transaction, subsequent entries are inner transactions
    const [transactionStack, setTransactionStack] = useState<PeraTransaction[]>(
        [],
    )

    const rootTx = request.txs?.at(0)?.at(0)

    // Current transaction is the last in the stack, or root if stack is empty
    const currentTx = useMemo(() => {
        return transactionStack.length > 0
            ? transactionStack[transactionStack.length - 1]
            : rootTx
    }, [transactionStack, rootTx])

    // Get inner transactions for the current transaction
    const innerTransactions = useMemo(() => {
        return currentTx ? getInnerTransactions(currentTx) : []
    }, [currentTx])

    const isViewingInnerTransaction = transactionStack.length > 0

    const handleNavigateToInner = useCallback((tx: PeraTransaction) => {
        setTransactionStack(prev => [...prev, tx])
    }, [])

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
