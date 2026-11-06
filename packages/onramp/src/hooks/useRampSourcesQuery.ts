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

import {
    skipToken,
    useQuery,
    type FetchStatus,
    type RefetchOptions,
} from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

import { getRampSources } from '../api'
import type { RampToken } from '../models'
import { onrampQueryKeys } from './querykeys'

export type UseRampSourcesQueryParams = {
    scope: Nullable<ChainScope>
    destinationId: Nullable<string>
    enabled?: boolean
}

export type UseRampSourcesQueryResult = {
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

/** What can fund `destinationId`: its fiat currencies and deposit coins. */
export const useRampSourcesQuery = ({
    scope,
    destinationId,
    enabled = true,
}: UseRampSourcesQueryParams): UseRampSourcesQueryResult => {
    const query = useQuery({
        queryKey: onrampQueryKeys.sources(destinationId, scope),
        queryFn:
            scope === null || destinationId === null
                ? skipToken
                : (): Promise<RampToken[]> =>
                      getRampSources(destinationId, scope),
        enabled: enabled && destinationId !== null,
    })

    return {
        data: query.data ?? NO_RESULTS,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error ?? null,
        fetchStatus: query.fetchStatus,
        // A skipToken query rejects a manual refetch.
        refetch: options =>
            scope === null || destinationId === null
                ? undefined
                : query.refetch(options),
    }
}
