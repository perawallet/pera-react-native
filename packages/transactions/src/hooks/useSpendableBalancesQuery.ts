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
import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import type { Optional } from '@perawallet/wallet-core-shared'
import type {
    SpendableBalance,
    SpendableBalanceInput,
} from '../transfer-adapter'
import { spendableBalanceQueryOptions } from './spendableBalanceQueryOptions'

export type UseSpendableBalancesQueryResult = {
    /** One entry per input, in order; `undefined` until that input's read lands. */
    data: Optional<SpendableBalance>[]
    /** True while any input's read is still in flight. */
    isPending: boolean
}

/** `useSpendableBalanceQuery` for several inputs at once, sharing its cache. */
export const useSpendableBalancesQuery = (
    inputs: readonly SpendableBalanceInput[],
): UseSpendableBalancesQueryResult => {
    const options = inputs.map(spendableBalanceQueryOptions)
    // A primitive, so `combine` keeps its identity and its result stays stable.
    const enabledKey = options.map(({ isEnabled }) => Number(isEnabled)).join()
    const combine = useCallback(
        (results: UseQueryResult<SpendableBalance>[]) => {
            const enabled = enabledKey.split(',')
            return {
                data: results.map(result => result.data),
                // TanStack reports a skipped query as pending.
                isPending: results.some(
                    (result, index) =>
                        enabled[index] === '1' && result.isPending,
                ),
            }
        },
        [enabledKey],
    )
    return useQueries({
        queries: options.map(({ options: query }) => query),
        combine,
    })
}
