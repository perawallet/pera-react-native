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
import {
    getAccountHeldAssets,
    type AccountHeldAsset,
    type AccountHoldingSource,
} from '../db'
import { HOLDINGS_ROWS_GC_TIME_MS } from '../constants'
import { getAccountHeldAssetsQueryKey } from './querykeys'

export type UseAccountHeldAssetsQueryResult = {
    /** Every asset the sources have a holding row for, zero balances included. */
    heldAssets: AccountHeldAsset[]
}

const NO_HELD_ASSETS: AccountHeldAsset[] = []

export const useAccountHeldAssetsQuery = (
    sources: readonly AccountHoldingSource[],
): UseAccountHeldAssetsQueryResult => {
    const query = useQuery({
        queryKey: getAccountHeldAssetsQueryKey(sources),
        enabled: sources.length > 0,
        // A SQLite read: the sync tick's invalidation refreshes it, and it
        // runs offline too rather than pausing.
        staleTime: Infinity,
        gcTime: HOLDINGS_ROWS_GC_TIME_MS,
        networkMode: 'always',
        queryFn: () => getAccountHeldAssets({ sources }),
    })

    return { heldAssets: query.data ?? NO_HELD_ASSETS }
}
