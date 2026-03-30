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

import { HistoryPeriod, Network } from '@perawallet/wallet-core-shared'
import { AccountAddress } from '../models'
import { Query, QueryClient, type QueryKey } from '@tanstack/react-query'

const MODULE_PREFIX = 'accounts'

export const isAccountQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX

export const getAccountBalancesQueryKey = (
    address: string,
    network: Network,
) => {
    return [MODULE_PREFIX, 'balance', { address, network }]
}

export const getAccountBalancesHistoryQueryKey = (
    addresses: AccountAddress[],
    period: HistoryPeriod,
    network: Network,
) => [MODULE_PREFIX, 'balance-history', { period, addresses, network }]

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
