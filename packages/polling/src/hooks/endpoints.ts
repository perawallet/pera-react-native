import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import type { ShouldRefreshResponse } from '../models'

export const getShouldRefreshEndpoint = () => {
    return '/v1/should-refresh'
}

export const sendShouldRefreshRequest = async (
    network: Network,
    addresses: string[],
    lastRefreshedRound: number | null,
) => {
    if (!addresses.length)
        return {
            refresh: false,
            round: null,
        }

    const response = await queryClient<ShouldRefreshResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: getShouldRefreshEndpoint(),
        data: {
            account_addresses: addresses,
            last_refreshed_round: lastRefreshedRound,
        },
    })

    return response.data
}
