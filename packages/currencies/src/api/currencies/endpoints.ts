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

import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { buildIntegrityHeadersWhenReady } from '@perawallet/wallet-core-app-integrity'
import { queryClient, type HistoryPeriod } from '@perawallet/wallet-core-shared'
import {
    currenciesListResponseSchema,
    currencyHistoryResponseSchema,
    currencyResponseSchema,
    type CurrencyApiResponse,
} from './schema'
import {
    transformCurrencyHistory,
    transformCurrencyList,
    transformCurrencyToPrice,
} from './transformers'
import type {
    Currency,
    CurrencyHistoryPoint,
    CurrencyPrice,
} from '../../models'

export type FetchCurrenciesListParams = {
    deployment: WalletMode
    signal?: AbortSignal
}

export const fetchCurrenciesList = async (
    params: FetchCurrenciesListParams,
): Promise<Currency[]> => {
    const { deployment, signal } = params

    const response = await queryClient<CurrencyApiResponse[]>({
        backend: 'pera',
        deployment,
        method: 'GET',
        url: `/v1/currencies/`,
        signal,
    })

    const validated = currenciesListResponseSchema.parse(response.data)
    return transformCurrencyList(validated)
}

export type FetchCurrencyParams = {
    currencyId: string
    deployment: WalletMode
    signal?: AbortSignal
}

export const fetchCurrency = async (
    params: FetchCurrencyParams,
): Promise<CurrencyPrice> => {
    const { currencyId, deployment, signal } = params

    const response = await queryClient<CurrencyApiResponse>({
        backend: 'pera',
        deployment,
        method: 'GET',
        url: `/v1/currencies/${currencyId}/`,
        signal,
    })

    const validated = currencyResponseSchema.parse(response.data)
    return transformCurrencyToPrice(validated)
}

export type FetchCurrencyHistoryParams = {
    currencyId: string
    period: HistoryPeriod
    deployment: WalletMode
    signal?: AbortSignal
}

/** The currency's daily USD rates over `period`, oldest first. */
export const fetchCurrencyHistory = async (
    params: FetchCurrencyHistoryParams,
): Promise<CurrencyHistoryPoint[]> => {
    const { currencyId, period, deployment, signal } = params

    const response = await queryClient<unknown>({
        backend: 'pera',
        deployment,
        method: 'GET',
        url: '/api/v3/currencies/history/',
        params: { currency: currencyId, period },
        headers: await buildIntegrityHeadersWhenReady(),
        signal,
    })

    return transformCurrencyHistory(
        currencyHistoryResponseSchema.parse(response.data),
    )
}
