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

import { useQuery } from '@tanstack/react-query'
import type {
    ChainScope,
    PageRef,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { TransactionDetailNotFoundError } from '../errors'
import {
    getMinedTransactionHistory,
    getPendingTransactionRecords,
} from '../pending-history'
import {
    historyReadRetryDelay,
    shouldRetryHistoryRead,
} from './historyReadRetry'
import { transactionQueryKeys } from './querykeys'

/** History pages read looking for the transaction before it counts as not found. */
export const MAX_RECORD_LOOKUP_PAGES = 5

export type UseTransactionRecordByIdQueryParams = {
    accountAddress: string
    scope: ChainScope
    transactionId: string
    isEnabled?: boolean
}

export type UseTransactionRecordByIdQueryResult = {
    /** `undefined` until found. */
    data: Optional<TransactionRecord>
    isLoading: boolean
    isError: boolean
    isPaused: boolean
    error: Nullable<Error>
    refetch: () => unknown
}

/**
 * The record History lists for `transactionId` in `accountAddress`'s history,
 * for a link that names only the id. Falls back to the wallet's own sends, which
 * the backend may not list yet. Rejects with {@link TransactionDetailNotFoundError}
 * when neither has it. Ids match exactly, so the caller passes the chain's
 * canonical spelling.
 */
export const useTransactionRecordByIdQuery = ({
    accountAddress,
    scope,
    transactionId,
    isEnabled = true,
}: UseTransactionRecordByIdQueryParams): UseTransactionRecordByIdQueryResult => {
    const query = useQuery({
        queryKey: transactionQueryKeys.recordById(
            accountAddress,
            scope,
            transactionId,
        ),
        enabled: isEnabled && !!accountAddress && !!transactionId,
        retry: shouldRetryHistoryRead,
        retryDelay: historyReadRetryDelay,
        queryFn: async ({ signal }): Promise<TransactionRecord> => {
            let page: Optional<PageRef>
            for (let read = 0; read < MAX_RECORD_LOOKUP_PAGES; read++) {
                signal.throwIfAborted()
                const mined = await getMinedTransactionHistory(
                    accountAddress,
                    scope,
                    page,
                    { signal },
                )
                const found = mined.items.find(r => r.id === transactionId)
                if (found) return found
                if (!mined.next) break
                page = mined.next
            }
            const own = await getPendingTransactionRecords({
                address: accountAddress,
                scope,
            })
            const sent = own.find(r => r.id === transactionId)
            if (sent) return sent
            throw new TransactionDetailNotFoundError(transactionId)
        },
    })

    return {
        data: query.data,
        isLoading: query.isLoading,
        isError: query.isError,
        isPaused: query.isPaused,
        error: query.error,
        refetch: query.refetch,
    }
}
