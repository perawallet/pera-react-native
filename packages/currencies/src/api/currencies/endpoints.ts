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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { Decimal } from 'decimal.js'
import {
    currenciesListResponseSchema,
    currencyResponseSchema,
    type CurrencyApiResponse,
} from './schema'
import { transformCurrencyList, transformCurrencyToPrice } from './transformers'
import type { Currency, CurrencyPrice } from '../../models'

export type FetchCurrenciesListParams = {
    network: Network
    signal?: AbortSignal
}

export const fetchCurrenciesList = async (
    params: FetchCurrenciesListParams,
): Promise<Currency[]> => {
    const { network, signal } = params

    // No Pera backend on betanet/custom: the request would throw
    // PeraServiceUnavailableError. Fall back to the default (empty) list.
    if (!isPeraBackedNetwork(network)) return []

    const response = await queryClient<CurrencyApiResponse[]>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/v1/currencies/`,
        signal,
    })

    const validated = currenciesListResponseSchema.parse(response.data)
    return transformCurrencyList(validated)
}

export type FetchCurrencyParams = {
    currencyId: string
    network: Network
    signal?: AbortSignal
}

export const fetchCurrency = async (
    params: FetchCurrencyParams,
): Promise<CurrencyPrice> => {
    const { currencyId, network, signal } = params

    // No Pera backend on betanet/custom: fall back to a zero rate rather than
    // throwing, so fiat amounts simply render $0.
    if (!isPeraBackedNetwork(network)) {
        return { id: currencyId, usdPrice: new Decimal(0) }
    }

    const response = await queryClient<CurrencyApiResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/v1/currencies/${currencyId}`,
        signal,
    })

    const validated = currencyResponseSchema.parse(response.data)
    return transformCurrencyToPrice(validated)
}
