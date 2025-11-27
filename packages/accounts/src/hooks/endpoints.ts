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
    queryClient,
    type HistoryPeriod,
    type Network,
} from '@perawallet/wallet-core-shared'

import { AccountBalanceHistoryResponse } from '../models'
import { Account } from '../models/algod-types/Account'

const getAccountBalancesEndpointPath = (address: string) =>
    `/v2/accounts/${address}`

export const fetchAccountBalances = async (
    address: string,
    network: Network,
): Promise<Account> => {
    const endpointPath = getAccountBalancesEndpointPath(address)
    const response = await queryClient<Account>({
        backend: 'algod',
        network,
        method: 'GET',
        url: endpointPath,
    })
    return response.data
}

export const getAccountsBalanceHistoryEndpointPath = () => `/v1/wallet/wealth/`

export const fetchAccountsBalanceHistory = async (
    addresses: string[],
    period: HistoryPeriod,
    network: Network,
): Promise<AccountBalanceHistoryResponse> => {
    const endpointPath = getAccountsBalanceHistoryEndpointPath()
    const response = await queryClient<AccountBalanceHistoryResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpointPath,
        params: {
            account_addresses: addresses,
            period,
        },
    })
    return response.data
}

export const getAccountAssetBalanceHistoryEndpointPath = (
    address: string,
    assetId: string,
) => `/v1/accounts/${address}/assets/${assetId}/balance-history/`

export const fetchAccountAssetBalanceHistory = async (
    address: string,
    assetId: string,
    period: HistoryPeriod,
    currency: string,
    network: Network,
): Promise<AccountBalanceHistoryResponse> => {
    const endpointPath = getAccountAssetBalanceHistoryEndpointPath(
        address,
        assetId,
    )
    const response = await queryClient<AccountBalanceHistoryResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpointPath,
        params: {
            period,
            currency,
        },
    })
    return response.data
}
