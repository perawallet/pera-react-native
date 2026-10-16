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

import { Decimal } from 'decimal.js'
import type {
    HoldingBalanceHistoryPoint,
    PortfolioHistoryPoint,
} from '@perawallet/wallet-core-accounts'
import {
    CHART_QUERY_TIMEOUT_MS,
    queryClient,
    type HistoryPeriod,
} from '@perawallet/wallet-core-shared'
import { type AlgorandNetworkId, algorandScope } from '../network-id'

export type PortfolioHistoryResponseItem = {
    datetime: string
    usd_value: string
    algo_value: string
    round: number
}

export type PortfolioHistoryResponse = {
    results: PortfolioHistoryResponseItem[]
}

export type HoldingBalanceHistoryResponseItem = {
    datetime: string
    /** Asset amount in display units; this endpoint has no algo_value field. */
    // lanekeep-ignore-next-line pera/amount-types reason: JSON wire response shape
    amount: string
    usd_value: string
    round: number
}

export type HoldingBalanceHistoryResponse = {
    results: HoldingBalanceHistoryResponseItem[]
}

export const getPortfolioHistoryEndpointPath = () => `/v1/wallet/wealth/`

export const getHoldingBalanceHistoryEndpointPath = (
    address: string,
    assetId: string,
) => `/v1/accounts/${address}/assets/${assetId}/balance-history/`

// `data` and `data.results` are absent when the endpoint answers with an empty
// or 204 body (the fetch layer yields `undefined` for those); that collapses to
// an empty chart rather than a query error.
export const fetchAlgorandPortfolioHistory = async (
    addresses: string[],
    period: HistoryPeriod,
    network: AlgorandNetworkId,
): Promise<PortfolioHistoryPoint[]> => {
    const response = await queryClient<PortfolioHistoryResponse>({
        backend: 'pera',
        scope: algorandScope(network),
        method: 'GET',
        url: getPortfolioHistoryEndpointPath(),
        params: {
            account_addresses: addresses,
            period,
        },
        timeout: CHART_QUERY_TIMEOUT_MS,
    })
    return (
        response.data?.results?.map(item => ({
            timestamp: Date.parse(item.datetime),
            usdValue: new Decimal(item.usd_value),
            nativeValue: new Decimal(item.algo_value),
        })) ?? []
    )
}

export const fetchAlgorandHoldingBalanceHistory = async (
    address: string,
    assetId: string,
    period: HistoryPeriod,
    currency: string,
    network: AlgorandNetworkId,
): Promise<HoldingBalanceHistoryPoint[]> => {
    const response = await queryClient<HoldingBalanceHistoryResponse>({
        backend: 'pera',
        scope: algorandScope(network),
        method: 'GET',
        url: getHoldingBalanceHistoryEndpointPath(address, assetId),
        params: {
            period,
            currency,
        },
        timeout: CHART_QUERY_TIMEOUT_MS,
    })
    return (
        response.data?.results?.map(item => ({
            timestamp: Date.parse(item.datetime),
            amount: new Decimal(item.amount ?? '0'),
            usdValue: new Decimal(item.usd_value ?? '0'),
        })) ?? []
    )
}
