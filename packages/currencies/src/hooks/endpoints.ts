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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import type { CurrenciesListResponse, CurrencyResponse } from '../models'

export const getCurrenciesListEndpointPath = () => `/v1/currencies/`

export const fetchCurrenciesList = async (network: Network) => {
    const endpointPath = getCurrenciesListEndpointPath()
    const response = await queryClient<CurrenciesListResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpointPath,
    })
    return response.data
}

export const getCurrencyEndpointPath = (currencyId: string) =>
    `/v1/currencies/${currencyId}`

export const fetchCurrency = async (network: Network, currencyId: string) => {
    const endpointPath = getCurrencyEndpointPath(currencyId)
    const response = await queryClient<CurrencyResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpointPath,
    })
    return response.data
}
