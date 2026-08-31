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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchRewardWithdrawEstimation } from '../api/reward'
import type { RewardWithdrawEstimation } from '../models'
import { useCardSession } from './useCardSession'
import { cardQueryKeys } from './querykeys'

export type UseRewardWithdrawEstimationQueryResult = {
    /** Null until the quote loads. */
    estimation: Nullable<RewardWithdrawEstimation>
    isLoading: boolean
    isError: boolean
}

/**
 * Fee quote for the confirm step. `enabled` gates the fetch to when the
 * confirm UI is actually shown — quotes go stale quickly, so no staleTime.
 */
export const useRewardWithdrawEstimationQuery = (
    isEnabled: boolean,
): UseRewardWithdrawEstimationQueryResult => {
    const { network } = useNetwork()
    const { isAuthenticated } = useCardSession()

    const query = useQuery({
        queryKey: cardQueryKeys.rewardWithdrawEstimation(network),
        queryFn: ({ signal }) =>
            fetchRewardWithdrawEstimation({ network, signal }),
        enabled: isEnabled && isAuthenticated,
    })

    return {
        estimation: query.data ?? null,
        isLoading: query.isLoading,
        isError: query.isError,
    }
}
