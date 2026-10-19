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
import { useAssetGroupsQuery } from '@perawallet/wallet-core-assets'
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
    /** Off where nothing could fold, so the groups request isn't sent. */
    isEnabled: boolean
}

export type UseGroupedHoldingsResult<T> = {
    items: GroupedHoldingItem<T>[]
}

const NO_GROUPS: never[] = []

export const useGroupedHoldings = <T extends GroupableHolding>({
    holdings,
    adapter,
    expandedGroupIds,
    isEnabled,
}: UseGroupedHoldingsParams<T>): UseGroupedHoldingsResult<T> => {
    const { groups } = useAssetGroupsQuery({ enabled: isEnabled })
    const effectiveGroups = isEnabled ? groups : NO_GROUPS

    const items = useMemo(
        () =>
            buildGroupedHoldingItems({
                holdings,
                groups: effectiveGroups,
                expandedGroupIds,
                adapter,
            }),
        [holdings, effectiveGroups, expandedGroupIds, adapter],
    )

    return { items }
}
