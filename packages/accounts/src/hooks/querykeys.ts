/*
 Copyright 2022-2025 Pera Wallet, LDA
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

const MODULE_PREFIX = 'accounts'

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

export const getAccountHoldingsPageQueryKey = (
    address: string,
    network: Network,
    params?: {
        filters?: AccountBalancesQueryKeyFilters
        sortMode?: string
        search?: string
    },
) => [MODULE_PREFIX, 'holdings-page', { address, network, ...params }]

export const getAccountBalancesHistoryQueryKey = (
    addresses: AccountAddress[],
    period: HistoryPeriod,
    network: Network,
) => [MODULE_PREFIX, 'balance-history', { period, addresses, network }]

export const getOnChainAccountInformationQueryKey = (
    address: string,
    network: Network,
) => [MODULE_PREFIX, 'on-chain-account-information', { address, network }]

export const getRekeyedAddressesQueryKey = (
    address: string,
    network: Network,
) => [MODULE_PREFIX, 'rekeyed-addresses', { address, network }]

export const getOwnedAssetIdsQueryKey = (network: Network) => [
    MODULE_PREFIX,
    'owned-asset-ids',
    { network },
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

export function invalidateAccountQueries(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === MODULE_PREFIX,
    })
}

/**
 * Scoped variant of {@link invalidateAccountQueries}: invalidates only the
 * account queries whose key payload targets one of the given addresses.
 *
 * The per-address query keys all carry `{ address }` as their third element
 * (balance, summary, holdings-page, …), so the sync service can refresh just
 * the accounts that actually changed this tick instead of fanning a wide DB
 * re-read across every mounted account query. Keys without an `address`
 * payload (e.g. network-scoped owned-asset-ids) are intentionally left alone.
 */
export function invalidateAccountQueriesForAddresses(
    queryClient: QueryClient,
    addresses: string[],
): void {
    if (addresses.length === 0) return
    const targets = new Set(addresses)
    void queryClient.invalidateQueries({
        predicate: query => {
            if (query.queryKey[0] !== MODULE_PREFIX) return false
            const payload = query.queryKey[2] as
                | { address?: string }
                | undefined
            return (
                payload?.address !== undefined && targets.has(payload.address)
            )
        },
    })
}
