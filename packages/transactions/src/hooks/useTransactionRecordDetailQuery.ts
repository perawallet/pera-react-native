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
    TransactionNative,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { TransactionDetailNotFoundError } from '../errors'
import { fetchTransactionDetail } from '../history-adapter'
import { transactionQueryKeys } from './querykeys'

export type UseTransactionRecordDetailQueryParams = {
    scope: ChainScope
    transactionId: string
    record: TransactionRecord
    isEnabled?: boolean
}

export type UseTransactionRecordDetailQueryResult = {
    /** `undefined` until loaded. */
    data: Optional<TransactionNative>
    isLoading: boolean
    isError: boolean
    isPaused: boolean
    error: Nullable<Error>
    refetch: () => unknown
}

/** A detail read from the chain for a history record. A transaction the chain no longer holds is an error. */
export const useTransactionRecordDetailQuery = ({
    scope,
    transactionId,
    record,
    isEnabled = true,
}: UseTransactionRecordDetailQueryParams): UseTransactionRecordDetailQueryResult => {
    const query = useQuery({
        queryKey: transactionQueryKeys.detail(scope, transactionId),
        // A mined transaction never changes.
        staleTime: Infinity,
        enabled: isEnabled && !!transactionId,
        queryFn: async () => {
            const detail = await fetchTransactionDetail(
                transactionId,
                scope,
                record,
            )
            if (!detail) throw new TransactionDetailNotFoundError(transactionId)
            return detail
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
