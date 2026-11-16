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
import { useQuery } from '@tanstack/react-query'
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeviceIdLookup } from '@perawallet/wallet-core-device'
import { fetchSwapHistory, routerAccountIdOrNull } from '../api'
import type { SwapAccountAddress, SwapHistoryItem } from '../models'
import { distinctSwapPairs } from '../utils/distinctSwapPairs'
import { isSwapHistoryRow } from '../utils/isSwapHistoryRow'
import { swapQueryKeys } from './querykeys'

const DISTINCT_PAIRS_LIMIT = 10
// The pairs are read off the newest history page; the router has no pair view.
const HISTORY_PAGE_SIZE = 50
// The accounts travel in the URL, one CAIP-10 id each; a wallet with many
// accounts on several chains would outgrow it in a single request.
const ACCOUNTS_PER_REQUEST = 20

const chunksOf = <T>(items: readonly T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
        items.slice(index * size, (index + 1) * size),
    )

/**
 * The newest distinct pairs any of `accounts` swapped, each with the account
 * that paid. The device and request scope come from the first account the
 * router has an id for.
 */
export const useDistinctPairsHistoryQuery = (
    accounts: SwapAccountAddress[],
) => {
    // An account on a network the router has no id for, such as a custom
    // node, can't have swapped there; leaving it out keeps the others' chips.
    const routable = useMemo(
        () =>
            accounts.flatMap(account => {
                const id = routerAccountIdOrNull(account.scope, account.address)
                return id ? [{ scope: account.scope, id }] : []
            }),
        [accounts],
    )
    const requestScope = routable.at(0)?.scope ?? null
    const deviceId = useDeviceIdLookup()(
        requestScope ? deploymentOf(requestScope) : null,
    )
    return useQuery({
        queryKey: swapQueryKeys.distinctPairsHistory(accounts),
        queryFn: async () => {
            if (!requestScope) throw new Error('No swap account to read')
            // Named rather than left to the device's registration, which
            // doesn't carry EVM addresses on every deployment.
            const pages = await Promise.allSettled(
                chunksOf(routable, ACCOUNTS_PER_REQUEST).map(chunk =>
                    fetchSwapHistory(
                        {
                            deviceId: deviceId ?? '',
                            accounts: chunk.map(account => account.id),
                            limit: HISTORY_PAGE_SIZE,
                        },
                        requestScope,
                    ),
                ),
            )
            const read = pages.flatMap(page =>
                page.status === 'fulfilled' ? [page.value] : [],
            )
            // One failed batch leaves the others' chips; only a total failure is an error.
            if (read.length === 0) {
                const [failure] = pages
                throw failure?.status === 'rejected'
                    ? failure.reason
                    : new Error('No swap history read')
            }
            const rows: SwapHistoryItem[] = read.flatMap(page =>
                page.results.filter(isSwapHistoryRow),
            )
            return distinctSwapPairs(rows, DISTINCT_PAIRS_LIMIT)
        },
        enabled: requestScope !== null && !!deviceId,
    })
}
