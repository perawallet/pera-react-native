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
    toScopeKey,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { AccountHoldingSource } from '../db'
import { useHoldingsRefreshStore } from '../store/holdingsRefresh'

const SEPARATOR = '|'

/**
 * Chains of `sources` whose last read failed, so a zero there is a
 * placeholder. Unlike `useUnreadHoldingChainIds` it leaves out chains never
 * read: a chain the build never reads would otherwise blank a total for good.
 */
export const useFailedHoldingChainIds = (
    sources: readonly AccountHoldingSource[],
): ReadonlySet<ChainId> => {
    // A string, so the set keeps its identity until a chain's read changes.
    const failed = useHoldingsRefreshStore(state =>
        sources
            .filter(
                ({ scope, address }) =>
                    state.failed[toScopeKey(scope)]?.[address] === true,
            )
            .map(({ scope }) => scope.chainId)
            .join(SEPARATOR),
    )

    return useMemo(
        () => new Set(failed ? (failed.split(SEPARATOR) as ChainId[]) : []),
        [failed],
    )
}
