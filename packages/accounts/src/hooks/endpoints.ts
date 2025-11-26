import {
    queryClient,
    type HistoryPeriod,
    type Network,
} from '@perawallet/wallet-core-shared'
import type {
    AccountBalanceHistoryResponse,
    AccountBalanceResponse,
} from '../models'

const getAccountBalancesEndpointPath = (address: string) =>
    `/v1/accounts/${address}/assets/`

export const fetchAccountBalances = async (
    address: string,
    network: Network,
): Promise<AccountBalanceResponse> => {
    const endpointPath = getAccountBalancesEndpointPath(address)
    const response = await queryClient({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpointPath,
        params: {
            include_algo: true,
        },
    })
    return response.data as AccountBalanceResponse
}

export const getAccountsBalanceHistoryEndpointPath = () => `/v1/wallet/wealth/`

export const fetchAccountsBalanceHistory = async (
    addresses: string[],
    period: HistoryPeriod,
    network: Network,
): Promise<AccountBalanceHistoryResponse> => {
    const endpointPath = getAccountsBalanceHistoryEndpointPath()
    const response = await queryClient({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpointPath,
        params: {
            account_addresses: addresses,
            period,
        },
    })
    return response.data as AccountBalanceHistoryResponse
}

export const getAccountAssetBalanceHistoryEndpointPath = (address: string, assetId: string) => `/v1/accounts/${address}/assets/${assetId}/balance-history/`

export const fetchAccountAssetBalanceHistory = async (
    address: string,
    assetId: string,
    period: HistoryPeriod,
    currency: string,
    network: Network,
): Promise<AccountBalanceHistoryResponse> => {
    const endpointPath = getAccountAssetBalanceHistoryEndpointPath(address, assetId)
    const response = await queryClient({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpointPath,
        params: {
            period,
            currency,
        },
    })
    return response.data as AccountBalanceHistoryResponse
}