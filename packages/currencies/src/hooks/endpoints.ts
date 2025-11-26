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
