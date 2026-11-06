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
import { useQuery } from '@tanstack/react-query'
import {
    isEvmChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { evmChainOf } from '../../chains/table'
import { fetchEvmTransactionSimulation } from '../api/endpoints'
import type { EvmSimulationRequest, EvmTransactionSimulation } from '../types'
import { simulationQueryKey } from './querykeys'

const PREDICTION_LIFETIME_MS = 60_000

export type UseEvmTransactionSimulationQueryParams = {
    scope: ChainScope
    request: Nullable<EvmSimulationRequest>
    isEnabled: boolean
}

export type UseEvmTransactionSimulationQueryResult = {
    data: Optional<EvmTransactionSimulation>
    isPending: boolean
    isError: boolean
}

/**
 * One prediction per call: a prediction is against one block, so a re-render
 * or a trip to the details screen must not ask again.
 */
export const useEvmTransactionSimulationQuery = ({
    scope,
    request,
    isEnabled,
}: UseEvmTransactionSimulationQueryParams): UseEvmTransactionSimulationQueryResult => {
    const isQueryEnabled = isEnabled && !!request && isEvmChainId(scope.chainId)
    // The key hashes the calldata, and the review re-renders on many writes.
    const queryKey = useMemo(
        () =>
            request
                ? simulationQueryKey(scope, request)
                : ['evm-simulations', 'none'],
        [scope, request],
    )
    const query = useQuery({
        queryKey,
        queryFn: () => {
            if (!request || !isEvmChainId(scope.chainId)) {
                throw new Error('A simulation needs an EVM call')
            }
            return fetchEvmTransactionSimulation(
                scope,
                evmChainOf(scope.chainId),
                request,
            )
        },
        enabled: isQueryEnabled,
        // A paused query would hold the review's spinner until the device
        // reads as online; failing fast shows "couldn't simulate" instead.
        networkMode: 'always',
        retry: false,
        staleTime: Infinity,
        // A prediction is against one block: kept long enough to spare a
        // re-render or a trip to the details screen, not to serve a later one.
        gcTime: PREDICTION_LIFETIME_MS,
    })
    return {
        data: query.data,
        isPending: isQueryEnabled && query.isPending,
        isError: query.isError,
    }
}
