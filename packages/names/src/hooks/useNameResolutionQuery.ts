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

import { useQueries } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useChainCapabilityCheck } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { nameSearchQueryOptions } from './nameSearchQuery'
import type { NameSearchResult } from '../models'

export type UseNameResolutionQueryResult = {
    data: Optional<NameSearchResult>
    isLoading: boolean
}

/**
 * Searches `name` on each scope with the `nameService` capability and returns
 * the first result of the first scope that has one.
 */
export const useNameResolutionQuery = (
    scopes: readonly ChainScope[],
    name: string,
    options?: { enabled?: boolean },
): UseNameResolutionQueryResult => {
    const check = useChainCapabilityCheck()
    const normalizedName = name.toLowerCase()
    const isEnabled = (options?.enabled ?? true) && normalizedName.length > 0

    const results = useQueries({
        queries: scopes.map(scope => ({
            ...nameSearchQueryOptions(scope, normalizedName),
            enabled:
                isEnabled &&
                check({
                    chain: {
                        chainId: scope.chainId,
                        capability: 'nameService',
                    },
                }),
        })),
    })

    return {
        data: results.find(query => query.data?.length)?.data?.at(0),
        isLoading: results.some(query => query.isLoading),
    }
}
