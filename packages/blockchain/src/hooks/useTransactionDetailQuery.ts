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

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useAlgorandClient } from './useAlgorandClient'
import { getTransactionDetailQueryKey } from './querykeys'
import { mapIndexerTxToDisplayableTransaction } from '../utils/transactions'
import type { PeraDisplayableTransaction } from '../models'

type UseTransactionDetailQueryParams = {
    transactionId: string
    isEnabled?: boolean
}

type UseTransactionDetailQueryResult =
    UseQueryResult<PeraDisplayableTransaction>

export const useTransactionDetailQuery = ({
    transactionId,
    isEnabled = true,
}: UseTransactionDetailQueryParams): UseTransactionDetailQueryResult => {
    const algokit = useAlgorandClient()

    return useQuery({
        queryKey: getTransactionDetailQueryKey(transactionId),
        queryFn: async () => {
            const response =
                await algokit.client.indexer.lookupTransactionById(
                    transactionId,
                )
            return mapIndexerTxToDisplayableTransaction(response.transaction)
        },
        enabled: isEnabled && Boolean(transactionId),
    })
}
