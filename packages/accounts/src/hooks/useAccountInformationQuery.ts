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
import {
    useNetwork,
    Address,
    type AccountInformation,
} from '@perawallet/wallet-core-blockchain'
import { getAccountBalance, getAccountHoldings } from '../db'

const getAccountInformationQueryKey = (address: string, network: string) => [
    'accounts',
    'account-information',
    { address, network },
]

export const useAccountInformationQuery = (address: string) => {
    const { network } = useNetwork()

    return useQuery({
        queryKey: getAccountInformationQueryKey(address, network),
        queryFn: async (): Promise<AccountInformation> => {
            const balance = await getAccountBalance({
                accountAddress: address,
                network,
            })
            const holdings = await getAccountHoldings({
                accountAddress: address,
                network,
            })

            return {
                minBalance: BigInt(balance?.minBalanceMicro ?? '0'),
                amount: BigInt(balance?.algoBalanceMicro ?? '0'),
                address: Address.fromString(address),
                status: balance?.status ?? 'Offline',
                rewards: 0n,
                assets: holdings.map(h => ({
                    assetId: BigInt(h.assetId),
                    amount: BigInt(h.amount),
                    isFrozen: false,
                })),
            }
        },
        staleTime: Infinity,
    })
}
