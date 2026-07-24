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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { SuggestedParams } from 'algosdk'
import { useAlgorandClient } from './useAlgorandClient'
import { useNetwork } from './useNetwork'
import { getSuggestedParametersQueryKey } from './querykeys'

// Suggested params carry a validity window, so a cached copy is only
// trustworthy for a few seconds — never long enough to build from minutes
// later (PERA-4579).
const SUGGESTED_PARAMS_STALE_TIME_MS = 10_000

export const useSuggestedParametersQuery = () => {
    const algokit = useAlgorandClient()
    const { network } = useNetwork()

    return useQuery({
        queryKey: getSuggestedParametersQueryKey(network),
        queryFn: async () => await algokit.getSuggestedParams(),
        staleTime: SUGGESTED_PARAMS_STALE_TIME_MS,
        // Run the fetch even while offline so consumers get a fast typed
        // rejection instead of a silent pause — a paused query kept the
        // whole Send input screen on a spinner (PERA-4579).
        networkMode: 'always',
    })
}

export type FetchSuggestedParameters = () => Promise<SuggestedParams>

/**
 * Imperative fetch-through-cache companion to
 * {@link useSuggestedParametersQuery} for on-demand consumers that must not
 * fetch eagerly on mount (e.g. the minimum-fee calculator, which only needs
 * params when a quantum signer is actually present). Shares the eager
 * hook's query key and staleness contract: a cached copy fresher than the
 * shared stale time is returned as-is, anything older is refetched — so
 * congestion-driven `minFee` changes propagate within the same bound as
 * every other consumer, and concurrent callers dedupe onto one request.
 */
export const useFetchSuggestedParameters = (): FetchSuggestedParameters => {
    const algokit = useAlgorandClient()
    const { network } = useNetwork()
    const queryClient = useQueryClient()

    return useCallback(
        () =>
            queryClient.fetchQuery({
                queryKey: getSuggestedParametersQueryKey(network),
                queryFn: async () => await algokit.getSuggestedParams(),
                staleTime: SUGGESTED_PARAMS_STALE_TIME_MS,
                networkMode: 'always',
            }),
        [algokit, network, queryClient],
    )
}
