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
import type {
    PeraDisplayableTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { useNetwork } from '@perawallet/wallet-core-chain-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { plannerAdapterFor } from '../chain-adapter'

type UseGroupSimulationQueryParams = {
    /** Identifies the request for caching; the query is disabled without it. */
    requestId?: string
    /** Raw group to simulate (full group context, falling back to `txs`). */
    groupTxs?: PeraTransaction[]
    /** Caller-side gate — typically "the group contains an app call". */
    enabled?: boolean
}

export type UseGroupSimulationQueryResult = {
    /** Flattened inner transactions; empty until (and unless) a simulation succeeds. */
    data: PeraDisplayableTransaction[]
    isFetching: boolean
    isSuccess: boolean
    isError: boolean
    error: Nullable<Error>
}

/**
 * Runs an unsigned simulation of a transaction group and returns its flattened
 * inner transactions, which the raw signing group never reveals.
 * Best-effort: `retry: false` and a caller-handled error mean a failure
 * simply yields no inner txns rather than blocking the flow.
 */
export const useGroupSimulationQuery = ({
    requestId,
    groupTxs,
    enabled = true,
}: UseGroupSimulationQueryParams): UseGroupSimulationQueryResult => {
    const { network } = useNetwork()

    const query = useQuery({
        queryKey: ['balance-impact-simulation', requestId, network],
        enabled: enabled && !!requestId && !!groupTxs?.length,
        staleTime: Infinity,
        retry: false,
        queryFn: () =>
            plannerAdapterFor(network).simulateGroup(groupTxs ?? [], network),
    })

    return {
        data: query.data ?? [],
        isFetching: query.isFetching,
        isSuccess: query.isSuccess,
        isError: query.isError,
        error: query.error,
    }
}
