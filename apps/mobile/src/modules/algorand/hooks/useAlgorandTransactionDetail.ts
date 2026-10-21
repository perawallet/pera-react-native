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
import { mapHistoryItemToTransactionNative } from '@perawallet/wallet-core-transactions'
import type {
    UseTransactionDetailParams,
    UseTransactionDetailResult,
} from '@modules/signing'

/**
 * The indexer fetch enriches the history row (note, inner txns), so it wins
 * once it lands; until then the mapped SQLite row renders, including while
 * offline.
 */
export const useAlgorandTransactionDetail = ({
    scope,
    transactionId,
    historyTransaction,
    isEnabled,
}: UseTransactionDetailParams): UseTransactionDetailResult => {
    const detailQuery = useTransactionDetailQuery({ transactionId, isEnabled })

    const localTransaction = useMemo(
        () =>
            historyTransaction
                ? mapHistoryItemToTransactionNative(
                      historyTransaction,
                      scope.chainId,
                  )
                : null,
        [historyTransaction, scope.chainId],
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
