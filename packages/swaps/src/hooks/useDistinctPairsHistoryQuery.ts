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

import { useCallback, useMemo } from 'react'
import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { useDeviceIdLookup } from '@perawallet/wallet-core-device'
import { fetchSwapHistory, readForOwnedAccounts } from '../api'
import type {
    SwapAccountAddress,
    SwapDistinctPairItem,
    SwapHistoryItem,
} from '../models'
import { distinctSwapPairs } from '../utils/distinctSwapPairs'
import { isSwapHistoryRow } from '../utils/isSwapHistoryRow'
import { swapHistoryBatchesOf } from '../utils/swapHistoryBatches'
import { swapQueryKeys } from './querykeys'

// The pairs are read off the newest history page; the router has no pair view.
const HISTORY_PAGE_SIZE = 50

export type UseDistinctPairsHistoryQueryResult = {
    data: SwapDistinctPairItem[]
    /** True only while nothing has loaded yet. */
    isLoading: boolean
    /** True only when every batch failed; a failed batch alone leaves the others' pairs and retries on its own. */
    isError: boolean
}

/**
 * Every distinct pair on the newest history page of any of `accounts`, each
 * with the account that paid. Accounts are named rather than left to the device's
 * registration, which doesn't carry EVM addresses on every deployment; one the
 * router refuses is dropped rather than failing its batch.
 */
export const useDistinctPairsHistoryQuery = (
    accounts: SwapAccountAddress[],
): UseDistinctPairsHistoryQueryResult => {
    const deviceIdOf = useDeviceIdLookup()
    const batches = useMemo(() => swapHistoryBatchesOf(accounts), [accounts])

    const combine = useCallback(
        (results: UseQueryResult<SwapHistoryItem[]>[]) => {
            const rows = results.flatMap(result => result.data ?? [])
            return {
                data: distinctSwapPairs(rows),
                isLoading:
                    rows.length === 0 &&
                    results.some(result => result.isLoading),
                isError:
                    results.length > 0 &&
                    results.every(result => result.isError),
            }
        },
        [],
    )

    return useQueries({
        queries: batches.map(batch => {
            const deviceId = deviceIdOf(batch.deployment)
            return {
                queryKey: swapQueryKeys.distinctPairsHistory(
                    batch.accounts.map(({ scope, address }) => ({
                        scope,
                        address,
                    })),
                ),
                queryFn: async () => {
                    const { value: page } = await readForOwnedAccounts(
                        batch.accounts.map(account => account.routerId),
                        (routerIds, limit) =>
                            fetchSwapHistory(
                                {
                                    deviceId: deviceId ?? '',
                                    accounts: routerIds,
                                    limit: limit ?? HISTORY_PAGE_SIZE,
                                },
                                batch.scope,
                            ),
                    )
                    return page.results.filter(isSwapHistoryRow)
                },
                enabled: !!deviceId,
            }
        }),
        combine,
    })
}
