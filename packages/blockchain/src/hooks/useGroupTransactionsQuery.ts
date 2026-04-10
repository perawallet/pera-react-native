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

import { useQuery } from '@tanstack/react-query'
import { useAlgorandClient } from './useAlgorandClient'
import { getGroupTransactionsQueryKey } from './querykeys'
import { mapIndexerTxToDisplayableTransaction } from '../utils/transactions'
import type { PeraDisplayableTransaction } from '../models'
import { useNetwork } from './useNetwork'

type UseGroupTransactionsQueryParams = {
    groupId: string | undefined
    isEnabled?: boolean
}

type UseGroupTransactionsQueryResult = {
    groupTransactions: PeraDisplayableTransaction[]
    isLoading: boolean
    isError: boolean
    error: Error | null
}

export const useGroupTransactionsQuery = ({
    groupId,
    isEnabled = true,
}: UseGroupTransactionsQueryParams): UseGroupTransactionsQueryResult => {
    const algokit = useAlgorandClient()
    const { network } = useNetwork()

    const query = useQuery({
        queryKey: getGroupTransactionsQueryKey(groupId ?? '', network),
        queryFn: async () => {
            const response = await algokit.client.indexer.searchForTransactions(
                {
                    groupId: groupId!,
                },
            )
            return response.transactions.map(
                mapIndexerTxToDisplayableTransaction,
            )
        },
        enabled: isEnabled && !!groupId,
    })

    return {
        groupTransactions: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
    }
}
