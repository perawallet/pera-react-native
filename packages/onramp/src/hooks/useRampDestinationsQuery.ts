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
import type { Nullable } from '@perawallet/wallet-core-shared'

import { getRampDestinations } from '../api'
import { rampChainAdapters } from '../chain-adapter'
import type { RampToken } from '../models'
import { rampTokenAsset } from '../token-identity'
import { onrampQueryKeys } from './querykeys'

export type UseRampDestinationsQueryParams = {
    scope: Nullable<ChainScope>
    enabled?: boolean
}

export type UseRampDestinationsQueryResult = {
    data: RampToken[]
    isLoading: boolean
    isError: boolean
    /** The failure behind `isError`, for callers that branch on its kind (an integrity refusal); null otherwise. */
    error: unknown
    fetchStatus: FetchStatus
    refetch: (options?: RefetchOptions) => unknown
}

// One stable empty array, so memos that depend on `data` don't re-run every render.
const NO_RESULTS: RampToken[] = []

/** What Fund can deliver on `scope`'s chain: the router's destinations that chain's adapter can read. */
export const useRampDestinationsQuery = ({
    scope,
    enabled = true,
}: UseRampDestinationsQueryParams): UseRampDestinationsQueryResult => {
    const hasAdapter = scope !== null && rampChainAdapters.has(scope.chainId)

    const query = useQuery({
        queryKey: onrampQueryKeys.destinations(scope),
        queryFn:
            scope === null
                ? skipToken
                : (): Promise<RampToken[]> => getRampDestinations(scope),
        enabled: enabled && hasAdapter,
    })

    const data = useMemo(
        () =>
            scope === null
                ? NO_RESULTS
                : (query.data?.filter(
                      token => rampTokenAsset(token, scope) !== null,
                  ) ?? NO_RESULTS),
        [query.data, scope],
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
