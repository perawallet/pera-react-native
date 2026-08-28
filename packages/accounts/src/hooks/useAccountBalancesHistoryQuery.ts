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

import { useQuery, type RefetchOptions } from '@tanstack/react-query'
import { fetchAccountsBalanceHistory } from './endpoints'
import {
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    AccountAddress,
    AccountBalanceHistoryItem,
    AccountBalanceHistoryResponse,
    AccountBalanceHistoryResponseItem,
} from '../models'
import { useCallback } from 'react'
import { Decimal } from 'decimal.js'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { getAccountBalancesHistoryQueryKey } from './querykeys'

const mapAccountBalanceHistoryItem = (
    item: AccountBalanceHistoryResponseItem,
    usdToPreferred: (amount: Decimal) => Nullable<Decimal>,
): AccountBalanceHistoryItem => {
    return {
        datetime: new Date(item.datetime),
        preferredValue: usdToPreferred(new Decimal(item.usd_value)),
        algoValue: new Decimal(item.algo_value),
        round: item.round,
    }
}

export type UseAccountBalancesHistoryQueryResult = {
    data: AccountBalanceHistoryItem[]
    isPending: boolean
    isSuccess: boolean
    isError: boolean
    isPaused: boolean
    error: Nullable<Error>
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
    refetch: (options?: RefetchOptions) => unknown
}

//TODO do we need to support pagination?
export const useAccountBalancesHistoryQuery = (
    addresses: AccountAddress[],
    period: HistoryPeriod,
    enabled = true,
): UseAccountBalancesHistoryQueryResult => {
    const { usdToPreferred } = useCurrency()
    const { network } = useNetwork()
    const isUnavailableOnNetwork = !isPeraBackedNetwork(network)
    const queryKey = getAccountBalancesHistoryQueryKey(
        addresses,
        period,
        network,
    )
    const query = useQuery({
        queryKey,
        // Gated by callers on chart visibility — this hits a slow network
        // endpoint and is only needed to render the wealth chart/trend.
        enabled: enabled && addresses.length > 0 && !isUnavailableOnNetwork,
        queryFn: () => fetchAccountsBalanceHistory(addresses, period, network),
        select: useCallback(
            (data: AccountBalanceHistoryResponse) =>
                data?.results?.map(item =>
                    mapAccountBalanceHistoryItem(item, usdToPreferred),
                ) ?? [],
            [usdToPreferred],
        ),
    })

    return {
        data: query.data ?? [],
        isPending: isUnavailableOnNetwork ? false : query.isPending,
        isSuccess: query.isSuccess,
        isError: query.isError,
        isPaused: query.isPaused,
        error: query.error,
        isUnavailableOnNetwork,
        // The observer's refetch() ignores `enabled` and would still fire the
        // doomed Pera request on a non-backed network.
        refetch: (options?: RefetchOptions) =>
            isUnavailableOnNetwork
                ? Promise.resolve(query)
                : query.refetch(options),
    }
}
