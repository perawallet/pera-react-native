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
import { useAccountChainStateStore } from '../store/accountChainState'
import { useHoldingsRefreshStore } from '../store/holdingsRefresh'

const SEPARATOR = '|'

/**
 * Chains of `sources` whose holdings no read vouches for: none has landed yet,
 * or the last one failed. A zero there may be a placeholder, not a balance.
 */
export const useUnreadHoldingChainIds = (
    sources: readonly AccountHoldingSource[],
): ReadonlySet<ChainId> => {
    // Primitives, so the set keeps its identity until a chain's read changes.
    const neverRead = useAccountChainStateStore(state =>
        sources
            .filter(
                ({ scope, address }) =>
                    state.states[toScopeKey(scope)]?.[address] === undefined,
            )
            .map(({ scope }) => scope.chainId)
            .join(SEPARATOR),
    )
    const failed = useHoldingsRefreshStore(state =>
        sources
            .filter(
                ({ scope, address }) =>
                    state.failed[toScopeKey(scope)]?.[address] === true,
            )
            .map(({ scope }) => scope.chainId)
            .join(SEPARATOR),
    )

    return useMemo(() => {
        const unread = [neverRead, failed].join(SEPARATOR).split(SEPARATOR)
        return new Set(
            sources
                .map(({ scope }) => scope.chainId)
                .filter(chainId => unread.includes(chainId)),
        )
    }, [sources, neverRead, failed])
}
