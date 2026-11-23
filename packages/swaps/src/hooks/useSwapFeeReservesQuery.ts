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

import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import type { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { swapAdapterFor } from '../chain-adapter'
import { swapQueryKeys } from './querykeys'

export type UseSwapFeeReservesQueryResult = {
    /** Base units of each scope's native asset; undefined until read, or when the read failed. */
    reserves: Optional<Decimal>[]
    isPending: boolean
}

// Fees move by the block; a minute-old price is still well inside the reserve's margin.
const FEE_RESERVE_STALE_TIME_MS = 60_000

const combine = (
    results: UseQueryResult<Decimal>[],
): UseSwapFeeReservesQueryResult => ({
    reserves: results.map(result => result.data),
    isPending: results.some(result => result.isPending),
})

/** The native fee each scope's MAX holds back, in `scopes` order. */
export const useSwapFeeReservesQuery = (
    scopes: readonly ChainScope[],
): UseSwapFeeReservesQueryResult =>
    useQueries({
        queries: scopes.map(scope => ({
            queryKey: swapQueryKeys.feeReserve(scope),
            queryFn: () => swapAdapterFor(scope).maxAmountFeeReserve(scope),
            staleTime: FEE_RESERVE_STALE_TIME_MS,
        })),
        combine,
    })
