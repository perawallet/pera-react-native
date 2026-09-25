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
    useQuery,
    type FetchStatus,
    type RefetchOptions,
} from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'

import { getRampPairs } from '../api'
import { ONRAMP_DESTINATION_TOKEN_IDS } from '../constants'
import type { RampPair } from '../models'
import { onrampQueryKeys } from './querykeys'

export type UseRampPairsQueryResult = {
    data: RampPair[]
    isLoading: boolean
    isError: boolean
    fetchStatus: FetchStatus
    refetch: (options?: RefetchOptions) => unknown
}

// One stable empty array, so memos that depend on `data` don't re-run every render.
const NO_RESULTS: RampPair[] = []

export const useRampPairsQuery = (
    enabled: boolean = true,
): UseRampPairsQueryResult => {
    const { network } = useNetwork()

    const destinationTokenIds = [...ONRAMP_DESTINATION_TOKEN_IDS]

    const query = useQuery({
        queryKey: onrampQueryKeys.pairs(destinationTokenIds, network),
        queryFn: () => getRampPairs(destinationTokenIds, network),
        enabled,
    })

    return {
        data: query.data ?? NO_RESULTS,
        isLoading: query.isLoading,
        isError: query.isError,
        fetchStatus: query.fetchStatus,
        refetch: query.refetch,
    }
}
