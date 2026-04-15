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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getAllAccountBalances } from '../db'
import { getAccountAuthAddressesQueryKey } from './querykeys'
import { useAllAccounts } from './useAllAccounts'

export type AuthAddressMap = ReadonlyMap<string, string | null>

type UseAccountAuthAddressesResult = {
    authAddresses: AuthAddressMap
    isPending: boolean
    isFetched: boolean
}

export const useAccountAuthAddresses = (): UseAccountAuthAddressesResult => {
    const { network } = useNetwork()
    const accounts = useAllAccounts()

    const addresses = accounts.map(a => a.address)
    const addressKey = addresses.join(',')

    const query = useQuery({
        queryKey: [...getAccountAuthAddressesQueryKey(network), { addressKey }],
        queryFn: async (): Promise<AuthAddressMap> => {
            if (addresses.length === 0) return new Map()
            const rows = await getAllAccountBalances({
                accountAddresses: addresses,
                network,
            })
            return new Map(rows.map(r => [r.accountAddress, r.authAddress]))
        },
        staleTime: Infinity,
    })

    return {
        authAddresses: query.data ?? new Map(),
        isPending: query.isPending,
        isFetched: query.isFetched,
    }
}
