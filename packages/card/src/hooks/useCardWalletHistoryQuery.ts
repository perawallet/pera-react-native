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
import { useInfiniteQuery } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchWalletHistory } from '../api/wallet-balance'
import type { CardWalletHistoryEntry, CardWalletKind } from '../models'
import { useCardSession } from './useCardSession'
import { cardQueryKeys } from './querykeys'

export type UseCardWalletHistoryQueryResult = {
    /** Every loaded page flattened, newest first as Baanx orders them. */
    entries: CardWalletHistoryEntry[]
    isLoading: boolean
    isFetchingNextPage: boolean
    isError: boolean
    hasNextPage: boolean
    fetchNextPage: () => void
}

/**
 * Idle until the wallet exists: history is keyed on the wallet's `id`, and a
 * wallet Baanx has not created yet (404 on the balance) has none to show.
 */
export const useCardWalletHistoryQuery = (
    kind: CardWalletKind,
    walletId: Nullable<string>,
): UseCardWalletHistoryQueryResult => {
    const { network } = useNetwork()
    const { isAuthenticated } = useCardSession()

    const query = useInfiniteQuery({
        queryKey: cardQueryKeys.walletHistory(network, kind, walletId ?? ''),
        queryFn: ({ pageParam, signal }) =>
            fetchWalletHistory({
                kind,
                walletId: walletId ?? '',
                page: pageParam,
                network,
                signal,
            }),
        initialPageParam: 0,
        getNextPageParam: lastPage =>
            lastPage.hasMore ? lastPage.page + 1 : undefined,
        enabled: isAuthenticated && walletId !== null,
    })

    const entries = useMemo(
        () => (query.data?.pages ?? []).flatMap(page => page.items),
        [query.data],
    )

    const fetchNextPage = useCallback(() => {
        void query.fetchNextPage()
    }, [query.fetchNextPage])

    return {
        entries,
        isLoading: query.isLoading,
        isFetchingNextPage: query.isFetchingNextPage,
        isError: query.isError,
        hasNextPage: query.hasNextPage,
        fetchNextPage,
    }
}
