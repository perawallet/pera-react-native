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
import type { Network } from '@perawallet/wallet-core-shared'
import { getAllAccountBalances } from '../db'

export const chainAuthAddressesQueryKey = (
    network: Network,
    addresses: string[],
) => ['accounts', 'chain-auth', network, [...addresses].sort()] as const

type UseChainAuthAddressesQueryParams = {
    addresses: string[]
    network: Network
    enabled?: boolean
}

type UseChainAuthAddressesQueryResult = {
    chainAuthAddresses: Map<string, string | null>
    isLoading: boolean
    isError: boolean
    error: Error | null
    refetch: () => void
}

export const useChainAuthAddressesQuery = ({
    addresses,
    network,
    enabled = true,
}: UseChainAuthAddressesQueryParams): UseChainAuthAddressesQueryResult => {
    const query = useQuery({
        queryKey: chainAuthAddressesQueryKey(network, addresses),
        queryFn: async () => {
            const rows = await getAllAccountBalances({
                accountAddresses: addresses,
                network,
            })
            return new Map<string, string | null>(
                rows.map(r => [r.accountAddress, r.authAddress ?? null]),
            )
        },
        enabled: enabled && addresses.length > 0,
    })

    return {
        chainAuthAddresses: query.data ?? new Map(),
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    }
}
