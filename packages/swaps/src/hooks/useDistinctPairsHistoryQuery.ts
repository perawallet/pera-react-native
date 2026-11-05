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
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeviceIdLookup } from '@perawallet/wallet-core-device'
import { fetchSwapHistory, routerAccountId } from '../api'
import { distinctSwapPairs } from '../utils/distinctSwapPairs'
import { isSwapHistoryRow } from '../utils/isSwapHistoryRow'
import { swapQueryKeys } from './querykeys'

const DISTINCT_PAIRS_LIMIT = 10
// The pairs are read off the newest history page; the router has no pair view.
const HISTORY_PAGE_SIZE = 50

export const useDistinctPairsHistoryQuery = (
    address: string,
    scope: ChainScope,
) => {
    const deviceId = useDeviceIdLookup()(deploymentOf(scope))
    return useQuery({
        queryKey: swapQueryKeys.distinctPairsHistory(address, scope),
        queryFn: async () => {
            const page = await fetchSwapHistory(
                {
                    deviceId: deviceId ?? '',
                    accounts: [routerAccountId(scope, address)],
                    limit: HISTORY_PAGE_SIZE,
                },
                scope,
            )
            return distinctSwapPairs(
                page.results.filter(isSwapHistoryRow),
                DISTINCT_PAIRS_LIMIT,
            )
        },
        enabled: address.length > 0 && !!deviceId,
    })
}
