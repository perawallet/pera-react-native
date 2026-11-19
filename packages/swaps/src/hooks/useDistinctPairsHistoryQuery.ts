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
import type {
    ChainScope,
    WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeviceIdLookup } from '@perawallet/wallet-core-device'
import {
    fetchSwapHistory,
    readForOwnedAccounts,
    routerAccountIdOrNull,
} from '../api'
import type {
    SwapAccountAddress,
    SwapDistinctPairItem,
    SwapHistoryItem,
} from '../models'
import { distinctSwapPairs } from '../utils/distinctSwapPairs'
import { isSwapHistoryRow } from '../utils/isSwapHistoryRow'
import { swapQueryKeys } from './querykeys'

const DISTINCT_PAIRS_LIMIT = 10
// The pairs are read off the newest history page; the router has no pair view.
const HISTORY_PAGE_SIZE = 50
// The accounts travel in the URL, one CAIP-10 id each; a wallet with many
// accounts on several chains would outgrow it in a single request.
const ACCOUNTS_PER_REQUEST = 20

type RoutableAccount = SwapAccountAddress & { routerId: string }

type HistoryBatch = {
    /** The deployment's own device id and router scope serve every account in it. */
    scope: ChainScope
    deployment: WalletMode
    accounts: RoutableAccount[]
}

export type UseDistinctPairsHistoryQueryResult = {
    data: SwapDistinctPairItem[]
    /** True only while nothing has loaded yet. */
    isLoading: boolean
    /** True only when every batch failed; a failed batch alone leaves the others' pairs and retries on its own. */
    isError: boolean
}

const chunksOf = <T>(items: readonly T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
        items.slice(index * size, (index + 1) * size),
    )

const batchesOf = (accounts: readonly SwapAccountAddress[]): HistoryBatch[] => {
    const byDeployment = new Map<WalletMode, RoutableAccount[]>()
    for (const account of accounts) {
        // An account on a network the router has no id for, such as a custom
        // node, or with no Pera deployment, can't have swapped there.
        const routerId = routerAccountIdOrNull(account.scope, account.address)
        const deployment = deploymentOf(account.scope)
        if (!routerId || !deployment) continue
        const group = byDeployment.get(deployment) ?? []
        group.push({ ...account, routerId })
        byDeployment.set(deployment, group)
    }
    return [...byDeployment].flatMap(([deployment, group]) =>
        chunksOf(group, ACCOUNTS_PER_REQUEST).map(chunk => ({
            scope: chunk[0].scope,
            deployment,
            accounts: chunk,
        })),
    )
}

/**
 * The newest distinct pairs any of `accounts` swapped, each with the account
 * that paid. Accounts are named rather than left to the device's
 * registration, which doesn't carry EVM addresses on every deployment; one the
 * router refuses is dropped rather than failing its batch.
 */
export const useDistinctPairsHistoryQuery = (
    accounts: SwapAccountAddress[],
): UseDistinctPairsHistoryQueryResult => {
    const deviceIdOf = useDeviceIdLookup()
    const batches = useMemo(() => batchesOf(accounts), [accounts])

    const combine = useCallback(
        (results: UseQueryResult<SwapHistoryItem[]>[]) => {
            const rows = results.flatMap(result => result.data ?? [])
            return {
                data: distinctSwapPairs(rows, DISTINCT_PAIRS_LIMIT),
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
