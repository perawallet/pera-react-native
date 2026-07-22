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
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import {
    useTransactionDetailQuery,
    useGroupTransactionsQuery,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { getNetworkErrorMessageKeys } from '@perawallet/wallet-core-shared'
import { mapHistoryItemToDisplayableTransaction } from '@perawallet/wallet-core-transactions'
import type { SigningStackParamList } from '@modules/signing/routes'

type NavigationProp = StackNavigationProp<
    SigningStackParamList,
    'TransactionDetails'
>

type TransactionDetailsRouteProp = RouteProp<
    SigningStackParamList,
    'TransactionDetails'
>

type TransactionDetailsRenderState =
    | { kind: 'content'; transaction: PeraDisplayableTransaction }
    | { kind: 'loading' }
    | { kind: 'offline' }
    | { kind: 'error'; titleKey: string; bodyKey: string }

type UseTransactionDetailsScreenResult = {
    renderState: TransactionDetailsRenderState
    groupTransactions: PeraDisplayableTransaction[]
    currentTransactionId: string
    isExternal: boolean
    handleTransactionPress: (tx: PeraDisplayableTransaction) => void
    handleRetry: () => void
}

export const useTransactionDetailsScreen =
    (): UseTransactionDetailsScreenResult => {
        const navigation = useNavigation<NavigationProp>()
        const route = useRoute<TransactionDetailsRouteProp>()

        const {
            transaction: paramTransaction,
            transactionId,
            groupId,
            isExternal,
            historyTransaction,
        } = route.params

        const detailQuery = useTransactionDetailQuery({
            transactionId: transactionId || paramTransaction?.id || '',
            isEnabled: !paramTransaction && !!transactionId,
        })

        const { groupTransactions } = useGroupTransactionsQuery({ groupId })

        // The signing flow's in-memory object is authoritative (unsigned txns
        // have no on-chain id). The indexer fetch enriches the history row
        // (note, inner txns), so prefer it once it lands; until then the
        // mapped SQLite row renders — including while offline.
        const localTransaction = useMemo(
            () =>
                historyTransaction
                    ? mapHistoryItemToDisplayableTransaction(historyTransaction)
                    : null,
            [historyTransaction],
        )
        const transaction =
            paramTransaction ?? detailQuery.data ?? localTransaction ?? null

        const renderState = useMemo((): TransactionDetailsRenderState => {
            if (transaction) {
                return { kind: 'content', transaction }
            }
            if (detailQuery.isError) {
                const { titleKey, bodyKey } = getNetworkErrorMessageKeys(
                    detailQuery.error,
                )
                return { kind: 'error', titleKey, bodyKey }
            }
            if (detailQuery.isPaused) {
                return { kind: 'offline' }
            }
            if (detailQuery.isLoading) {
                return { kind: 'loading' }
            }
            const { titleKey, bodyKey } = getNetworkErrorMessageKeys(undefined)
            return { kind: 'error', titleKey, bodyKey }
        }, [
            transaction,
            detailQuery.isError,
            detailQuery.error,
            detailQuery.isPaused,
            detailQuery.isLoading,
        ])

        const handleTransactionPress = useCallback(
            (tx: PeraDisplayableTransaction) => {
                navigation.push('TransactionDetails', {
                    transaction: tx,
                    groupId,
                })
            },
            [navigation, groupId],
        )

        const handleRetry = useCallback(() => {
            void detailQuery.refetch()
        }, [detailQuery])

        return {
            renderState,
            groupTransactions,
            currentTransactionId: transaction?.id ?? transactionId ?? '',
            isExternal: isExternal ?? false,
            handleTransactionPress,
            handleRetry,
        }
    }
