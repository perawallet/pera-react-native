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

import { useEffect } from 'react'
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    getReplaceableSubmissionAttempt,
    subscribeToSubmissionLedger,
} from '@perawallet/wallet-core-signing'
import { getReplaceableTransactionQueryKey, MODULE_PREFIX } from './querykeys'

export type UseReplaceableTransactionQueryResult = {
    /** The wallet holds what it needs to speed up or cancel the transaction. */
    isReplaceable: boolean
}

export const useReplaceableTransactionQuery = (
    record?: TransactionRecord,
): UseReplaceableTransactionQueryResult => {
    const queryClient = useQueryClient()
    const isEnabled =
        record?.status === 'pending' &&
        getChainDescriptor(record.scope.chainId).protocol.supportsReplacement
    const queryKey = record
        ? getReplaceableTransactionQueryKey(record.scope, record.id)
        : ([MODULE_PREFIX, 'replaceable'] as const)

    const query = useQuery({
        queryKey,
        queryFn:
            isEnabled && record
                ? async () =>
                      (await getReplaceableSubmissionAttempt({
                          scope: record.scope,
                          txId: record.id,
                      })) !== null
                : skipToken,
        // A ledger read, so it must not pause offline.
        networkMode: 'always',
    })

    // A newer attempt at the same sequence number takes the offer away.
    const scope = record?.scope
    const txId = record?.id
    useEffect(() => {
        if (!isEnabled || !scope || txId === undefined) return
        return subscribeToSubmissionLedger(() => {
            void queryClient.invalidateQueries({
                queryKey: getReplaceableTransactionQueryKey(scope, txId),
            })
        })
    }, [isEnabled, queryClient, scope, txId])

    return { isReplaceable: isEnabled && query.data === true }
}
