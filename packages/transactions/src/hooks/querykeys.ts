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

import type { Query, QueryClient, QueryKey } from '@tanstack/react-query'
import type { Decimal } from 'decimal.js'
import {
    queryKeyReferencesScope,
    type AssetRef,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'

export const MODULE_PREFIX = 'transactions'

export const isTransactionQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX

/**
 * Query key factory for transaction history queries.
 */
export const transactionQueryKeys = {
    all: [MODULE_PREFIX] as const,

    history: (accountAddress: string, scope: ChainScope) =>
        [MODULE_PREFIX, 'history', { accountAddress, scope }] as const,

    historyWithFilters: (
        accountAddress: string,
        scope: ChainScope,
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
            { accountAddress, scope, ...filters },
        ] as const,

    records: (
        accountAddress: string,
        scope: ChainScope,
        filters: {
            assetId?: string
            afterTime?: string
            beforeTime?: string
        },
    ) =>
        [
            MODULE_PREFIX,
            'records',
            { accountAddress, scope, ...filters },
        ] as const,

    paginatedHistory: (
        accountAddress: string,
        scope: ChainScope,
        url: string,
    ) =>
        [
            MODULE_PREFIX,
            'history',
            'page',
            { accountAddress, scope, url },
        ] as const,

    /**
     * `fee` is in base units. The key carries it as plain text so it stays
     * serialisable; `toFixed` because `toString` switches to exponent form.
     */
    spendableBalance: (
        address: string,
        asset: AssetRef,
        scope: ChainScope,
        fee: Decimal,
    ) =>
        [
            MODULE_PREFIX,
            'spendable-balance',
            { accountAddress: address, asset, scope, fee: fee.toFixed() },
        ] as const,

    addressPoisoning: (recipient: string, scope: ChainScope) =>
        [MODULE_PREFIX, 'address-poisoning', { recipient, scope }] as const,

    /** `amount` is in base units, carried as plain text like `fee` above. */
    recipientWarning: (
        recipient: string,
        asset: AssetRef,
        scope: ChainScope,
        amount: Decimal,
    ) =>
        [
            MODULE_PREFIX,
            'recipient-warning',
            { recipient, asset, scope, amount: amount.toFixed() },
        ] as const,

    /** `amount` is in base units, carried as plain text like `fee` above. */
    transferFeeEstimate: (
        from: string,
        to: string,
        asset: AssetRef,
        scope: ChainScope,
        amount: Decimal,
    ) =>
        [
            MODULE_PREFIX,
            'transfer-fee-estimate',
            {
                accountAddress: from,
                to,
                asset,
                scope,
                amount: amount.toFixed(),
            },
        ] as const,
}

export function invalidateTransactionQueries(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === MODULE_PREFIX,
    })
}

/**
 * Scoped variant of {@link invalidateTransactionQueries} for one chain scope,
 * so a sync pass on one chain doesn't refetch another chain's backend-read
 * history.
 */
export function invalidateTransactionQueriesForScope(
    queryClient: QueryClient,
    scope: ChainScope,
): void {
    void queryClient.invalidateQueries({
        predicate: query =>
            query.queryKey[0] === MODULE_PREFIX &&
            queryKeyReferencesScope(query.queryKey, scope),
    })
}

export function invalidateSpendableBalanceQueries(
    queryClient: QueryClient,
): void {
    void queryClient.invalidateQueries({
        queryKey: [MODULE_PREFIX, 'spendable-balance'],
    })
}

/**
 * Scoped variant of {@link invalidateTransactionQueries}: invalidates only the
 * transaction queries whose key payload targets one of the given addresses.
 * Every key in this module carries the account in an `accountAddress` payload
 * field (history, filtered history, pagination pages), so a post-submission
 * refresh can re-read just the affected accounts' histories instead of
 * refetching every mounted account's infinite query, all pages included.
 * Pass `scope` to stop at one chain: EVM chains share addresses.
 */
export function invalidateTransactionQueriesForAddresses(
    queryClient: QueryClient,
    addresses: string[],
    scope?: ChainScope,
): void {
    if (addresses.length === 0) return
    const targets = new Set(addresses)
    void queryClient.invalidateQueries({
        predicate: query =>
            query.queryKey[0] === MODULE_PREFIX &&
            (scope === undefined ||
                queryKeyReferencesScope(query.queryKey, scope)) &&
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

export const getReplaceableTransactionQueryKey = (
    scope: ChainScope,
    txId: string,
) => [MODULE_PREFIX, 'replaceable', { scope, txId }] as const

// Its own prefix, and deliberately not 'transactions': the app's query
// persistence classifies this one (an inbox request list survives a restart).
const ASSET_INBOX_MODULE_PREFIX = 'asa-inbox'

export const getAssetInboxRequestsQueryKey = (
    address: string,
    scope: ChainScope,
) => [ASSET_INBOX_MODULE_PREFIX, 'requests', { address, scope }]

export const getAssetInboxSendSummaryQueryKey = (
    receiver: string,
    assetId: string,
    scope: ChainScope,
) => [ASSET_INBOX_MODULE_PREFIX, 'send-summary', { receiver, assetId, scope }]

export const isAssetInboxQuery = (query: Query): boolean =>
    query.queryKey.at(0) === ASSET_INBOX_MODULE_PREFIX
