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

import { useQuery } from '@tanstack/react-query'
import { fetchAccountsBalanceHistory } from './endpoints'
import {
    type HistoryPeriod,
    type Network,
} from '@perawallet/wallet-core-shared'
import type {
    AccountAddress,
    AccountBalanceHistoryItem,
    AccountBalanceHistoryResponse,
    AccountBalanceHistoryResponseItem,
} from '../models'
import { useCallback } from 'react'
import Decimal from 'decimal.js'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { useCurrency } from '@perawallet/wallet-core-currencies'

const mapAccountBalanceHistoryItem = (
    item: AccountBalanceHistoryResponseItem,
    usdToPreferred: (amount: Decimal) => Decimal,
): AccountBalanceHistoryItem => {
    return {
        datetime: new Date(item.datetime),
        fiatValue: usdToPreferred(new Decimal(item.usd_value)),
        algoValue: new Decimal(item.algo_value),
        round: item.round,
    }
}

export const getAccountBalancesHistoryQueryKey = (
    addresses: AccountAddress[],
    period: HistoryPeriod,
    network: Network,
) => ['v1', 'wallet', 'wealth', { period, addresses }, network]

//TODO do we need to support pagination?
export const useAccountBalancesHistoryQuery = (
    addresses: AccountAddress[],
    period: HistoryPeriod,
) => {
    const { usdToPreferred } = useCurrency()
    const { network } = useNetwork()
    const queryKey = getAccountBalancesHistoryQueryKey(
        addresses,
        period,
        network,
    )
    const query = useQuery({
        queryKey,
        queryFn: () => fetchAccountsBalanceHistory(addresses, period, network),
        select: useCallback(
            (data: AccountBalanceHistoryResponse) =>
                data.results?.map(item =>
                    mapAccountBalanceHistoryItem(item, usdToPreferred),
                ) ?? [],
            [usdToPreferred],
        ),
    })

    return query
}
