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

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchWalletBalance } from '../api/wallet-balance'
import type { CardWalletBalance, CardWalletKind } from '../models'
import { useCardSession } from './useCardSession'
import { cardQueryKeys } from './querykeys'

export type UseCardWalletBalanceQueryResult = {
    /** Null while loading, and while nothing has been credited to it yet. */
    wallet: Nullable<CardWalletBalance>
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
    refetch: () => void
}

/** Withdrawal freshness comes from invalidation in `useWithdrawWalletBalanceMutation`. */
export const useCardWalletBalanceQuery = (
    kind: CardWalletKind,
): UseCardWalletBalanceQueryResult => {
    const { network } = useNetwork()
    const { isAuthenticated } = useCardSession()

    const query = useQuery({
        queryKey: cardQueryKeys.walletBalance(network, kind),
        queryFn: ({ signal }) => fetchWalletBalance({ kind, network, signal }),
        staleTime: config.reactQueryShortLivedStaleTime,
        // The wallet routes require a Baanx session; stay idle otherwise.
        enabled: isAuthenticated,
    })

    const refetch = useCallback(() => {
        void query.refetch()
    }, [query.refetch])

    return {
        wallet: query.data ?? null,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch,
    }
}
