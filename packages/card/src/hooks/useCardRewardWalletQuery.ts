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
import { fetchRewardWallet } from '../api/reward'
import type { CardRewardWallet } from '../models'
import { useCardSession } from './useCardSession'
import { cardQueryKeys } from './querykeys'

export type UseCardRewardWalletQueryResult = {
    /** Null until the wallet loads. */
    rewardWallet: Nullable<CardRewardWallet>
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
    refetch: () => void
}

/** Withdrawal freshness comes from invalidation in `useWithdrawRewardMutation`. */
export const useCardRewardWalletQuery = (): UseCardRewardWalletQueryResult => {
    const { network } = useNetwork()
    const { isAuthenticated } = useCardSession()

    const query = useQuery({
        queryKey: cardQueryKeys.rewardWallet(network),
        queryFn: ({ signal }) => fetchRewardWallet({ network, signal }),
        staleTime: config.reactQueryShortLivedStaleTime,
        // The wallet routes require a Baanx session — stay idle otherwise.
        enabled: isAuthenticated,
    })

    const refetch = useCallback(() => {
        void query.refetch()
    }, [query.refetch])

    return {
        rewardWallet: query.data ?? null,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch,
    }
}
