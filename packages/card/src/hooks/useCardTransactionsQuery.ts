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

import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { fetchCardTransactions } from '../api/transactions'
import type { CardTransaction, CardTransactionFilters } from '../models'
import { cardQueryKeys } from './querykeys'

export type UseCardTransactionsQueryResult = {
    transactions: CardTransaction[]
    isLoading: boolean
    isError: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    fetchNextPage: () => void
    refetch: () => void
}

export const useCardTransactionsQuery = (
    filters?: CardTransactionFilters,
): UseCardTransactionsQueryResult => {
    const { network } = useNetwork()

    const query = useInfiniteQuery({
        queryKey: cardQueryKeys.transactions(network, filters),
        queryFn: ({ pageParam, signal }) =>
            fetchCardTransactions({
                network,
                page: pageParam,
                filters,
                signal,
            }),
        initialPageParam: 0,
        getNextPageParam: lastPage =>
            lastPage.hasMore ? lastPage.page + 1 : undefined,
    })

    const transactions = useMemo(
        () => (query.data?.pages ?? []).flatMap(page => page.items),
        [query.data],
    )

    return {
        transactions,
        isLoading: query.isLoading,
        isError: query.isError,
        isFetchingNextPage: query.isFetchingNextPage,
        hasNextPage: query.hasNextPage,
        fetchNextPage: () => {
            void query.fetchNextPage()
        },
        refetch: () => {
            void query.refetch()
        },
    }
}
