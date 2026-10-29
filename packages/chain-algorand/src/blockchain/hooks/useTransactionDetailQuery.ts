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

import { useQuery, type RefetchOptions } from '@tanstack/react-query'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import { useAlgorandClient } from './useAlgorandClient'
import { getTransactionDetailQueryKey } from './querykeys'
import { mapIndexerTxToDisplayableTransaction } from '../utils/transactions'
import { toAlgorandNative } from '../models/transaction-view'
import { ALGORAND_CHAIN_ID } from '../../chain-id'

type UseTransactionDetailQueryParams = {
    transactionId: string
    isEnabled?: boolean
}

export type UseTransactionDetailQueryResult = {
    /** `undefined` until loaded; callers fall back to other sources on it. */
    data: Optional<TransactionNative>
    isPending: boolean
    isLoading: boolean
    isSuccess: boolean
    isError: boolean
    isPaused: boolean
    error: Nullable<Error>
    refetch: (options?: RefetchOptions) => unknown
}

export const useTransactionDetailQuery = ({
    transactionId,
    isEnabled = true,
}: UseTransactionDetailQueryParams): UseTransactionDetailQueryResult => {
    const algokit = useAlgorandClient()
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)

    const isQueryEnabled = isEnabled && !!transactionId

    const query = useQuery({
        queryKey: getTransactionDetailQueryKey(transactionId, scope),
        queryFn: async () => {
            const response = await algokit.client.indexer
                .lookupTransactionByID(transactionId)
                .do()
            return toAlgorandNative(
                mapIndexerTxToDisplayableTransaction(response.transaction),
            )
        },
        enabled: isQueryEnabled,
    })

    return {
        data: query.data,
        isPending: isQueryEnabled && query.isPending,
        isLoading: query.isLoading,
        isSuccess: query.isSuccess,
        isError: query.isError,
        isPaused: query.isPaused,
        error: query.error,
        refetch: query.refetch,
    }
}
