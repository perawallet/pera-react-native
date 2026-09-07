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

import type { Network } from '@perawallet/wallet-core-shared'
import type { QueryClient, QueryKey } from '@tanstack/react-query'

export const MODULE_PREFIX = 'transactions'

export const isTransactionQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX

/**
 * Query key factory for transaction history queries.
 */
export const transactionQueryKeys = {
    all: [MODULE_PREFIX] as const,

    history: (accountAddress: string, network: Network) =>
        [MODULE_PREFIX, 'history', { accountAddress, network }] as const,

    historyWithFilters: (
        accountAddress: string,
        network: Network,
        filters: {
            assetId?: string
            afterTime?: string
            beforeTime?: string
            limit?: number
        },
    ) =>
        [
            MODULE_PREFIX,
            'history',
            { accountAddress, network, ...filters },
        ] as const,

    paginatedHistory: (accountAddress: string, network: Network, url: string) =>
        [
            MODULE_PREFIX,
            'history',
            'page',
            { accountAddress, network, url },
        ] as const,

    /**
     * Txids with an open submission-ledger row — the "pending —
     * verifying" badge set. Kept under the module prefix so
     * `invalidateTransactionQueries` also refreshes it.
     */
    openSubmissionTxIds: (network: Network) =>
        [MODULE_PREFIX, 'open-submission-txids', { network }] as const,
}

export function invalidateTransactionQueries(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === MODULE_PREFIX,
    })
}

/**
 * Scoped variant of {@link invalidateTransactionQueries}: invalidates only the
 * transaction queries whose key payload targets one of the given addresses.
 * Every key in this module carries the account in an `accountAddress` payload
 * field (history, filtered history, pagination pages), so a post-submission
 * refresh can re-read just the affected accounts' histories instead of
 * refetching every mounted account's infinite query, all pages included.
 */
export function invalidateTransactionQueriesForAddresses(
    queryClient: QueryClient,
    addresses: string[],
): void {
    if (addresses.length === 0) return
    const targets = new Set(addresses)
    void queryClient.invalidateQueries({
        predicate: query =>
            query.queryKey[0] === MODULE_PREFIX &&
            query.queryKey.some(part => {
                if (typeof part !== 'object' || part === null) return false
                const { accountAddress } = part as Record<string, unknown>
                return (
                    typeof accountAddress === 'string' &&
                    targets.has(accountAddress)
                )
            }),
    })
}
