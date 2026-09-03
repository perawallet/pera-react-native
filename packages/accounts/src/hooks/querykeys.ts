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

import {
    type HistoryPeriod,
    type Network,
} from '@perawallet/wallet-core-shared'
import { type AccountAddress } from '../models'
import {
    type Query,
    type QueryClient,
    type QueryKey,
} from '@tanstack/react-query'

export const MODULE_PREFIX = 'accounts'

export const isAccountQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX

type AccountBalancesQueryKeyFilters = {
    hideZeroBalance?: boolean
    hideNfts?: boolean
    hideOptedInNfts?: boolean
    excludeAssetTypes?: string[]
}

export const getAccountBalancesQueryKey = (
    address: string,
    network: Network,
    filters?: AccountBalancesQueryKeyFilters,
) => {
    return [MODULE_PREFIX, 'balance', { address, network, filters }]
}

export const getAccountSummaryQueryKey = (
    address: string,
    network: Network,
) => [MODULE_PREFIX, 'summary', { address, network }]

// Network-agnostic by design (see `getAccountFundedNetworks`), but keyed on the
// active network so the entry refetches once a newly selected network syncs.
// The `{ address }` payload keeps it inside the sync tick's scoped invalidation.
export const getAccountFundedNetworksQueryKey = (
    address: string,
    network: Network,
) => [MODULE_PREFIX, 'funded-networks', { address, network }]

export const getAccountHoldingsPageQueryKey = (
    address: string,
    network: Network,
    params?: {
        filters?: AccountBalancesQueryKeyFilters
        sortMode?: string
        search?: string
    },
) => [MODULE_PREFIX, 'holdings-page', { address, network, ...params }]

export const getAccountCollectiblesQueryKey = (
    address: string,
    network: Network,
    params?: {
        sortMode?: string
        search?: string
        includeOptedInOnly?: boolean
    },
) => [MODULE_PREFIX, 'collectibles', { address, network, ...params }]

export const getAccountBalancesHistoryQueryKey = (
    addresses: AccountAddress[],
    period: HistoryPeriod,
    network: Network,
) => [MODULE_PREFIX, 'balance-history', { period, addresses, network }]

/**
 * Wealth chart-history key guard. Allowlisted into query persistence:
 * balance history is network-only (no SQLite table backs it)
 * and carries no PII, so the last successful snapshot is safe and cheap to
 * persist. Deliberately excludes the per-account asset balance-history key
 * (['accounts','assets','balance-history',…]).
 */
export const isAccountBalancesHistoryQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX && queryKey[1] === 'balance-history'

export const getOnChainAccountInformationQueryKey = (
    address: string,
    network: Network,
) => [MODULE_PREFIX, 'on-chain-account-information', { address, network }]

// The { address } payload keeps this key inside the sync tick's scoped
// invalidation, so a fresh opt-in reorders the gallery on the next sync.
export const getAccountOptInRoundsQueryKey = (
    address: string,
    network: Network,
) => [MODULE_PREFIX, 'opt-in-rounds', { address, network }]

export const getRekeyedAddressesQueryKey = (
    address: string,
    network: Network,
) => [MODULE_PREFIX, 'rekeyed-addresses', { address, network }]

export const getOwnedAssetIdsQueryKey = (network: Network) => [
    MODULE_PREFIX,
    'owned-asset-ids',
    { network },
]

export const getAssetHoldersQueryKey = (assetId: string, network: Network) => [
    MODULE_PREFIX,
    'asset-holders',
    { assetId, network },
]

export const getAccountAssetBalanceHistoryQueryKey = (
    network: Network,
    account_address: string,
    asset_id: string,
    period: HistoryPeriod,
    currency: string,
) => [
    MODULE_PREFIX,
    'assets',
    'balance-history',
    { period, currency, network, asset_id, account_address },
]

export const getInvalidateAccountBalancesPredicate = (query: Query) =>
    query.queryKey.length >= 2 &&
    query.queryKey.at(0) === MODULE_PREFIX &&
    query.queryKey.at(1) === 'balance'

/**
 * The holdings page is read from SQLite with `staleTime: Infinity`, so a write
 * that changes what the read returns — including one made by another module,
 * e.g. the favorite flag the sort keys off — has to invalidate it explicitly.
 */
export const getInvalidateAccountHoldingsPredicate = (query: Query) =>
    query.queryKey.length >= 2 &&
    query.queryKey.at(0) === MODULE_PREFIX &&
    query.queryKey.at(1) === 'holdings-page'

// Object-payload fields naming a single account. Scalar only: the plural
// `addresses` aggregate (balance-history) is deliberately excluded so
// multi-account keys keep being invalidated, not evicted.
const SINGLE_ACCOUNT_FIELDS = ['address', 'account_address'] as const

/**
 * True when any element of the key names a target account. Scans every element
 * rather than assuming a fixed shape: most keys hold the address in an object
 * payload at index 2 (`address`), the asset balance-history key at index 3
 * (`account_address`), and a bare address segment (`[..., address]`) is matched
 * too. The `MODULE_PREFIX` gate at the call sites scopes this to account keys,
 * and a 58-char address won't collide with a literal path segment.
 */
const queryKeyTargetsAccount = (
    queryKey: QueryKey,
    targets: Set<string>,
): boolean =>
    queryKey.some(part => {
        if (typeof part === 'string') return targets.has(part)
        if (typeof part !== 'object' || part === null) return false
        const payload = part as Record<string, unknown>
        return SINGLE_ACCOUNT_FIELDS.some(field => {
            const value = payload[field]
            return typeof value === 'string' && targets.has(value)
        })
    })

export function invalidateAccountQueries(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === MODULE_PREFIX,
    })
}

// Multi-account aggregate keys (balance-history) hold the address list in a
// plural `addresses` payload field; a match means the aggregate covers at
// least one target account.
const queryKeyTargetsAccountAggregate = (
    queryKey: QueryKey,
    targets: Set<string>,
): boolean =>
    queryKey.some(part => {
        if (typeof part !== 'object' || part === null) return false
        const { addresses } = part as Record<string, unknown>
        return (
            Array.isArray(addresses) &&
            addresses.some(
                address => typeof address === 'string' && targets.has(address),
            )
        )
    })

/**
 * Scoped variant of {@link invalidateAccountQueries}: invalidates only the
 * account queries whose key payload targets one of the given addresses.
 *
 * The per-address query keys carry a single-account address in their object
 * payload (`{ address }` for balance/summary/holdings-page/…, `account_address`
 * for asset balance-history), so the sync service can refresh just the accounts
 * that actually changed this tick instead of fanning a wide DB re-read across
 * every mounted account query. Keys without a single-account payload (e.g.
 * network-scoped owned-asset-ids, multi-account balance-history) are left alone
 * by default; `includeMultiAccountKeys` additionally invalidates multi-account
 * aggregates (the wealth-chart balance-history) whose `addresses` payload
 * intersects the targets — wanted by the post-submission refresh, where the
 * chart must reflect the send, but not by the sync tick, whose broad
 * asset-phase invalidation already covers periodic drift.
 */
export function invalidateAccountQueriesForAddresses(
    queryClient: QueryClient,
    addresses: string[],
    options?: { includeMultiAccountKeys?: boolean },
): void {
    if (addresses.length === 0) return
    const targets = new Set(addresses)
    const includeMultiAccountKeys = options?.includeMultiAccountKeys ?? false
    void queryClient.invalidateQueries({
        predicate: query =>
            query.queryKey[0] === MODULE_PREFIX &&
            (queryKeyTargetsAccount(query.queryKey, targets) ||
                (includeMultiAccountKeys &&
                    queryKeyTargetsAccountAggregate(query.queryKey, targets))),
    })
}

/**
 * Evicts (not just invalidates) the cached account queries for the given
 * addresses. Used on account removal: invalidate would leave the gone account's
 * datasets (e.g. a 5k-row holdings page) sitting in cache until gcTime, where
 * the periodic sync's broad invalidations keep re-marking them stale. Removing
 * them frees the memory and stops that churn. Keys without a single-account
 * payload (e.g. network-scoped owned-asset-ids, multi-account balance-history)
 * are left for the caller to refresh.
 */
export function removeAccountQueriesForAddresses(
    queryClient: QueryClient,
    addresses: string[],
): void {
    if (addresses.length === 0) return
    const targets = new Set(addresses)
    queryClient.removeQueries({
        predicate: query =>
            query.queryKey[0] === MODULE_PREFIX &&
            queryKeyTargetsAccount(query.queryKey, targets),
    })
}
