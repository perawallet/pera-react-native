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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    buildGroupedHoldingItems,
    type GroupableHolding,
    type GroupableHoldingAdapter,
    type GroupedHoldingItem,
} from '../utils/groupedHoldings'

export type UseGroupedHoldingsParams<T extends GroupableHolding> = {
    holdings: T[]
    adapter: GroupableHoldingAdapter<T>
    expandedGroupIds: ReadonlySet<string>
    /** Off where nothing could fold, so no holding is asked for its group. */
    isEnabled: boolean
    /** Chains whose holdings no read vouches for yet; a group never values their zeros. */
    unreadChainIds?: ReadonlySet<ChainId>
}

export type UseGroupedHoldingsResult<T> = {
    items: GroupedHoldingItem<T>[]
}

export const useGroupedHoldings = <T extends GroupableHolding>({
    holdings,
    adapter,
    expandedGroupIds,
    isEnabled,
    unreadChainIds,
}: UseGroupedHoldingsParams<T>): UseGroupedHoldingsResult<T> => {
    const items = useMemo(
        () =>
            isEnabled
                ? buildGroupedHoldingItems({
                      holdings,
                      expandedGroupIds,
                      adapter,
                      unreadChainIds,
                  })
                : holdings.map(holding => ({
                      kind: 'holding' as const,
                      holding,
                      isGroupMember: false,
                  })),
        [holdings, expandedGroupIds, adapter, isEnabled, unreadChainIds],
    )

    return { items }
}
