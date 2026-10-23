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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    isIntegrityRequiredError,
    isPeraServiceUnavailableError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    hasCachedHistoryRows,
    useTransactionHistoryQuery,
    useTransactionRecordsQuery,
} from '@perawallet/wallet-core-transactions'
import {
    buildRecordListRows,
    buildTransactionListRows,
    type TransactionListRow,
} from '../../utils/transactionListRows'

export type UseTransactionHistoryRowsParams = {
    accountAddress?: string
    scope: ChainScope
    assetId?: string
    /** `YYYY-MM-DD`, inclusive. */
    afterTime?: string
    /** `YYYY-MM-DD`, inclusive. */
    beforeTime?: string
}

export type UseTransactionHistoryRowsResult = {
    /** Date headers and transaction rows, flattened for a recycling list */
    rows: TransactionListRow[]
    /** Transactions loaded so far, headers not counted. */
    transactionCount: number
    isLoading: boolean
    /** See `UseTransactionHistoryQueryResult.isFetched`. */
    isFetched: boolean
    isFetchingNextPage: boolean
    isError: boolean
    error: Nullable<Error>
    /** Nothing loaded and the read failed: a retry state, not the skeleton. */
    isLoadFailed: boolean
    /** The failure is a Pera service this network doesn't have, so retrying can't help. */
    isLoadUnavailable: boolean
    isLoadIntegrityBlocked: boolean
    hasNextPage: boolean
    /** See `UseTransactionRecordsQueryResult.isSearchPaused`; `fetchNextPage` resumes it. */
    isSearchPaused: boolean
    fetchNextPage: () => void
    /** Re-requests whichever page failed: the next one when pages loaded before it. */
    retry: () => void
    /** A failed read is being re-requested; the error stays set until it settles. */
    isRetrying: boolean
}

/**
 * One account's history as list rows: cached rows on a chain that keeps them,
 * the chain's records otherwise. Both queries are mounted and only the
 * chain's own one is enabled, so hook order never depends on the chain.
 */
export const useTransactionHistoryRows = ({
    accountAddress,
    scope,
    assetId,
    afterTime,
    beforeTime,
}: UseTransactionHistoryRowsParams): UseTransactionHistoryRowsResult => {
    const isRowCached = hasCachedHistoryRows(scope.chainId)
    const filters = { assetId, afterTime, beforeTime }

    const historyQuery = useTransactionHistoryQuery({
        accountAddress: accountAddress ?? '',
        scope,
        isEnabled: isRowCached && !!accountAddress,
        ...filters,
    })
    const recordsQuery = useTransactionRecordsQuery({
        accountAddress: accountAddress ?? '',
        scope,
        isEnabled: !isRowCached && !!accountAddress,
        ...filters,
    })

    const { transactions } = historyQuery
    const { records } = recordsQuery
    const rows = useMemo(
        () =>
            isRowCached
                ? buildTransactionListRows(transactions)
                : buildRecordListRows(records),
        [isRowCached, transactions, records],
    )

    const query = isRowCached ? historyQuery : recordsQuery
    // A failed read leaves `hasNextPage` set, so without this a screen reads
    // it as a load still in progress and the skeleton never leaves.
    const isLoadFailed = rows.length === 0 && query.isError
    const { hasNextPage, fetchNextPage, refetch } = query
    const retry = useCallback(
        () => (hasNextPage ? fetchNextPage() : refetch()),
        [hasNextPage, fetchNextPage, refetch],
    )

    return {
        rows,
        transactionCount: isRowCached ? transactions.length : records.length,
        isLoading: query.isLoading,
        isFetched: query.isFetched,
        isFetchingNextPage: query.isFetchingNextPage,
        isError: query.isError,
        error: query.error,
        isLoadFailed,
        isLoadUnavailable:
            isLoadFailed && isPeraServiceUnavailableError(query.error),
        isLoadIntegrityBlocked:
            isLoadFailed && isIntegrityRequiredError(query.error),
        hasNextPage,
        isSearchPaused: !isRowCached && recordsQuery.isSearchPaused,
        fetchNextPage,
        retry,
        isRetrying: query.isError && query.isFetching,
    }
}
