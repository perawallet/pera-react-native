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

import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type {
    ChainScope,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { subscribeToSubmissionLedger } from '@perawallet/wallet-core-signing'
import { getPendingTransactionRecords } from '../pending-history'
import { transactionQueryKeys } from './querykeys'

export type UsePendingTransactionRecordsQueryParams = {
    accountAddress: string
    scope: ChainScope
    isEnabled?: boolean
}

export type UsePendingTransactionRecordsQueryResult = {
    /** Newest first, none matched against the chain's history yet. */
    records: TransactionRecord[]
    refetch: () => void
}

const NO_RECORDS: TransactionRecord[] = []

/**
 * The account's own sends from the submission ledger, read apart from the
 * chain's history so they show whatever the backend does.
 */
export const usePendingTransactionRecordsQuery = ({
    accountAddress,
    scope,
    isEnabled = true,
}: UsePendingTransactionRecordsQueryParams): UsePendingTransactionRecordsQueryResult => {
    const queryClient = useQueryClient()
    const { chainId, networkId } = scope
    const isActive = isEnabled && !!accountAddress

    const query = useQuery({
        queryKey: transactionQueryKeys.pendingRecords(accountAddress, scope),
        queryFn: () =>
            getPendingTransactionRecords({
                address: accountAddress,
                scope,
                listedIds: new Set(),
            }),
        // SQLite only: offline is when these rows matter most.
        networkMode: 'always',
        enabled: isActive,
    })

    useEffect(() => {
        if (!isActive) return
        return subscribeToSubmissionLedger(() => {
            void queryClient.invalidateQueries({
                queryKey: transactionQueryKeys.pendingRecords(accountAddress, {
                    chainId,
                    networkId,
                }),
            })
        })
    }, [isActive, queryClient, accountAddress, chainId, networkId])

    const { refetch } = query
    const handleRefetch = useCallback(() => void refetch(), [refetch])

    return { records: query.data ?? NO_RECORDS, refetch: handleRefetch }
}
