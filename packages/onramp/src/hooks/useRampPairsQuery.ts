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
import {
    skipToken,
    useQuery,
    type FetchStatus,
    type RefetchOptions,
} from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    isRegionRestricted,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import type { Nullable } from '@perawallet/wallet-core-shared'

import { getRampPairs } from '../api'
import { rampChainAdapters } from '../chain-adapter'
import type { RampPair } from '../models'
import { isOfferedRampPair } from '../token-identity'
import { onrampQueryKeys } from './querykeys'

export type UseRampPairsQueryParams = {
    scope: Nullable<ChainScope>
    enabled?: boolean
}

export type UseRampPairsQueryResult = {
    data: RampPair[]
    isLoading: boolean
    isError: boolean
    /** The failure behind `isError`, for callers that branch on its kind (an integrity refusal); null otherwise. */
    error: unknown
    fetchStatus: FetchStatus
    refetch: (options?: RefetchOptions) => unknown
}

// One stable empty array, so memos that depend on `data` don't re-run every render.
const NO_RESULTS: RampPair[] = []
const NO_TOKEN_IDS: readonly string[] = []
const XO_PROVIDER_ID = 'xo'

export const useRampPairsQuery = ({
    scope,
    enabled = true,
}: UseRampPairsQueryParams): UseRampPairsQueryResult => {
    const destinationTokenIds = [
        ...(scope !== null && rampChainAdapters.has(scope.chainId)
            ? rampChainAdapters.get(scope.chainId).destinationTokenIds
            : NO_TOKEN_IDS),
    ]

    const query = useQuery({
        queryKey: onrampQueryKeys.pairs(destinationTokenIds, scope),
        queryFn:
            scope === null
                ? skipToken
                : () => getRampPairs(destinationTokenIds, scope),
        enabled: enabled && destinationTokenIds.length > 0,
    })

    const remoteConfig = useRemoteConfig()
    // XO is itself a crypto swap, so leaving Swap out removes it too.
    const isXoRestricted = (['xo_swap', 'swap'] as const).some(feature =>
        isRegionRestricted(remoteConfig, feature),
    )

    const data = useMemo(
        () =>
            query.data?.filter(
                pair =>
                    isOfferedRampPair(pair) &&
                    !(
                        isXoRestricted &&
                        pair.provider.id.toLowerCase() === XO_PROVIDER_ID
                    ),
            ) ?? NO_RESULTS,
        [query.data, isXoRestricted],
    )

    return {
        data,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error ?? null,
        fetchStatus: query.fetchStatus,
        // A skipToken query rejects a manual refetch.
        refetch: options =>
            scope === null ? undefined : query.refetch(options),
    }
}
