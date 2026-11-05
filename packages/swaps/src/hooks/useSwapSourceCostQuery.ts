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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { swapAdapterFor, type SwapSourceCost } from '../chain-adapter'
import type { SwapQuote } from '../models'
import { swapQueryKeys } from './querykeys'

export type UseSwapSourceCostQueryResult = {
    sourceCost: Nullable<SwapSourceCost>
    isLoading: boolean
}

/** A failed read shows nothing and blocks nothing: execution checks again. */
export const useSwapSourceCostQuery = ({
    quote,
    scope,
}: {
    quote: SwapQuote
    scope: ChainScope
}): UseSwapSourceCostQueryResult => {
    const { data, isLoading } = useQuery({
        queryKey: swapQueryKeys.sourceCost(quote.quoteId, scope),
        queryFn: () =>
            swapAdapterFor(scope).estimateSourceCost({ quote, scope }),
        retry: false,
    })
    return { sourceCost: data ?? null, isLoading }
}
