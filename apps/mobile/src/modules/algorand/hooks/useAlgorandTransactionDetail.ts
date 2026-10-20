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

import { useMemo } from 'react'
import { useTransactionDetailQuery } from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    LEGACY_CHAIN_ID,
    type TransactionNative,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    mapHistoryItemToTransactionNative,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'

type UseAlgorandTransactionDetailParams = {
    transactionId: string
    historyTransaction?: TransactionHistoryItem
    isEnabled: boolean
}

type UseAlgorandTransactionDetailResult = {
    transaction: Nullable<TransactionNative>
    isPaused: boolean
    isError: boolean
    isLoading: boolean
    error: Nullable<Error>
    refetch: () => unknown
}

/**
 * The indexer fetch enriches the history row (note, inner txns), so it wins
 * once it lands; until then the mapped SQLite row renders, including while
 * offline.
 */
export const useAlgorandTransactionDetail = ({
    transactionId,
    historyTransaction,
    isEnabled,
}: UseAlgorandTransactionDetailParams): UseAlgorandTransactionDetailResult => {
    const detailQuery = useTransactionDetailQuery({ transactionId, isEnabled })

    const localTransaction = useMemo(
        () =>
            historyTransaction
                ? mapHistoryItemToTransactionNative(
                      historyTransaction,
                      LEGACY_CHAIN_ID,
                  )
                : null,
        [historyTransaction],
    )
    const transaction = detailQuery.data ?? localTransaction

    return {
        transaction,
        isPaused: detailQuery.isPaused,
        isError: detailQuery.isError,
        isLoading: detailQuery.isLoading,
        error: detailQuery.error,
        refetch: detailQuery.refetch,
    }
}
