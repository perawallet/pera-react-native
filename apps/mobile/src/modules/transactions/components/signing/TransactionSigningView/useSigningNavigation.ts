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
    type PeraDisplayableTransaction,
    mapToDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'

export type SigningViewType =
    | 'single-summary'
    | 'single-details'
    | 'group-list'
    | 'group-details'
    | 'multi-group-list'
    | 'transaction-details'

export type NavigationState = {
    viewType: SigningViewType
    groupIndex?: number
    transactionIndex?: number
    transaction?: PeraDisplayableTransaction
}

type UseSigningNavigationParams = {
    request: TransactionSignRequest
}

type UseSigningNavigationResult = {
    navigationStack: NavigationState[]
    currentView: NavigationState
    rootViewType: SigningViewType
    isSingleTransaction: boolean
    isSingleGroup: boolean
    isMultipleGroups: boolean
    groups: PeraDisplayableTransaction[][]
    allTransactions: PeraDisplayableTransaction[]
    totalFee: bigint
    navigateToDetails: (tx?: PeraDisplayableTransaction) => void
    navigateToGroup: (groupIndex: number) => void
    navigateToTransaction: (
        transactionIndex: number,
        groupIndex?: number,
    ) => void
    navigateToInnerTransaction: (tx: PeraDisplayableTransaction) => void
    navigateBack: () => void
    canGoBack: boolean
}

export const useSigningNavigation = ({
    request,
}: UseSigningNavigationParams): UseSigningNavigationResult => {
    const groups = useMemo(
        () =>
            request.txs.map(group =>
                group
                    .map(tx => mapToDisplayableTransaction(tx))
                    .filter((tx): tx is PeraDisplayableTransaction => !!tx),
            ),
        [request.txs],
    )

    const allTransactions = useMemo(() => groups.flat(), [groups])

    const isSingleTransaction =
        groups.length === 1 && groups[0]?.length === 1
    const isSingleGroup = groups.length === 1 && !isSingleTransaction
    const isMultipleGroups = groups.length > 1

    const rootViewType: SigningViewType = useMemo(() => {
        if (isSingleTransaction) return 'single-summary'
        if (isSingleGroup) return 'group-list'
        return 'multi-group-list'
    }, [isSingleTransaction, isSingleGroup])

    const [navigationStack, setNavigationStack] = useState<NavigationState[]>([
        { viewType: rootViewType },
    ])

    const currentView = navigationStack[navigationStack.length - 1] ?? {
        viewType: rootViewType,
    }

    const totalFee = useMemo(() => {
        return allTransactions.reduce(
            (sum, tx) => sum + (tx.fee ?? 0n),
            0n,
        )
    }, [allTransactions])

    const canGoBack = navigationStack.length > 1

    const navigateToDetails = useCallback(
        (tx?: PeraDisplayableTransaction) => {
            const targetTx = tx ?? groups[0]?.[0]
            if (!targetTx) return

            setNavigationStack(prev => [
                ...prev,
                {
                    viewType: 'single-details',
                    transaction: targetTx,
                },
            ])
        },
        [groups],
    )

    const navigateToGroup = useCallback(
        (groupIndex: number) => {
            setNavigationStack(prev => [
                ...prev,
                {
                    viewType: 'group-list',
                    groupIndex,
                },
            ])
        },
        [],
    )

    const navigateToTransaction = useCallback(
        (transactionIndex: number, groupIndex?: number) => {
            const gIdx = groupIndex ?? currentView.groupIndex ?? 0
            const tx = groups[gIdx]?.[transactionIndex]
            if (!tx) return

            setNavigationStack(prev => [
                ...prev,
                {
                    viewType: 'transaction-details',
                    groupIndex: gIdx,
                    transactionIndex,
                    transaction: tx,
                },
            ])
        },
        [groups, currentView.groupIndex],
    )

    const navigateToInnerTransaction = useCallback(
        (tx: PeraDisplayableTransaction) => {
            setNavigationStack(prev => [
                ...prev,
                {
                    viewType: 'transaction-details',
                    transaction: tx,
                },
            ])
        },
        [],
    )

    const navigateBack = useCallback(() => {
        if (navigationStack.length > 1) {
            setNavigationStack(prev => prev.slice(0, -1))
        }
    }, [navigationStack.length])

    return {
        navigationStack,
        currentView,
        rootViewType,
        isSingleTransaction,
        isSingleGroup,
        isMultipleGroups,
        groups,
        allTransactions,
        totalFee,
        navigateToDetails,
        navigateToGroup,
        navigateToTransaction,
        navigateToInnerTransaction,
        navigateBack,
        canGoBack,
    }
}
