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

const sourceKeyOf = ({ scope, address }: AccountHoldingSource): string =>
    `${toScopeKey(scope)}|${address}`
const LIST_SEPARATOR = '\n'

/**
 * Chains of `sources` whose first read failed, so their native zero is the
 * seeded placeholder. A chain read but with holdings unrefreshed has a real
 * balance, and one never read would blank a total for good: both stay out.
 */
export const useFailedFirstReadChainIds = (
    sources: readonly AccountHoldingSource[],
): ReadonlySet<ChainId> => {
    // Strings, so the set keeps its identity until a chain's read changes.
    const failed = useHoldingsRefreshStore(state =>
        sources
            .filter(
                ({ scope, address }) =>
                    state.failed[toScopeKey(scope)]?.[address] === true,
            )
            .map(sourceKeyOf)
            .join(LIST_SEPARATOR),
    )
    const read = useAccountChainStateStore(state =>
        sources
            .filter(
                ({ scope, address }) =>
                    state.states[toScopeKey(scope)]?.[address] !== undefined,
            )
            .map(sourceKeyOf)
            .join(LIST_SEPARATOR),
    )

    return useMemo(() => {
        const failedKeys = new Set(failed.split(LIST_SEPARATOR))
        const readKeys = new Set(read.split(LIST_SEPARATOR))
        return new Set(
            sources
                .filter(
                    source =>
                        failedKeys.has(sourceKeyOf(source)) &&
                        !readKeys.has(sourceKeyOf(source)),
                )
                .map(({ scope }) => scope.chainId),
        )
    }, [sources, failed, read])
}
