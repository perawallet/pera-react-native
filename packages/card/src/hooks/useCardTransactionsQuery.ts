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
import { useInfiniteQuery } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { fetchCardTransactions } from '../api/transactions'
import type { CardTransactionFilters } from '../models'
import { cardQueryKeys } from './querykeys'

type CardTransactionsQueryOptions = {
    /**
     * Pass false for cache-read consumers (e.g. the detail screen, which only
     * looks up a row already fetched by the list): a mount-refetch of a stale
     * infinite query replays every loaded page sequentially for no new data.
     */
    refetchOnMount?: boolean
}

/**
 * Returns the flattened `transactions` plus the rest of the infinite-query
 * result (`hasNextPage`, `fetchNextPage`, `isLoading`, …).
 */
export const useCardTransactionsQuery = (
    filters?: CardTransactionFilters,
    options?: CardTransactionsQueryOptions,
) => {
    const { network } = useNetwork()

    const { data, ...rest } = useInfiniteQuery({
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
        refetchOnMount: options?.refetchOnMount ?? true,
    })

    const transactions = useMemo(
        () => (data?.pages ?? []).flatMap(page => page.items),
        [data],
    )

    return { transactions, ...rest }
}
