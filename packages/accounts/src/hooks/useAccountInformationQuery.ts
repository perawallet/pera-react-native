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

import { useQuery } from '@tanstack/react-query'
import { isAlgoAssetId, type Optional } from '@perawallet/wallet-core-shared'
import {
    useNetwork,
    Address,
    algosToMicroAlgosBigInt,
    toBigInt,
    type AccountInformation,
} from '@perawallet/wallet-core-blockchain'

import { getAccountBalance, getAccountHoldings } from '../db'

const getAccountInformationQueryKey = (address: string, network: string) => [
    'accounts',
    'account-information',
    { address, network },
]

export type UseAccountInformationQueryResult = {
    /** `undefined` until loaded; callers gate on it, so no default. */
    data: Optional<AccountInformation>
    isPending: boolean
    isLoading: boolean
    isSuccess: boolean
}

export const useAccountInformationQuery = (
    address: string,
): UseAccountInformationQueryResult => {
    const { network } = useNetwork()

    const query = useQuery({
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
                minBalance: balance
                    ? algosToMicroAlgosBigInt(balance.minBalance)
                    : 0n,
                amount: balance
                    ? algosToMicroAlgosBigInt(balance.algoBalance)
                    : 0n,
                address: Address.fromString(address),
                status: balance?.status ?? 'Offline',
                rewards: 0n,
                // ALGO is persisted as a holding row for the home-screen reads,
                // but AccountInformation.assets is ASAs-only — the algo balance
                // is carried separately in `amount` above.
                assets: holdings
                    .filter(h => !isAlgoAssetId(h.assetId))
                    .map(h => ({
                        assetId: BigInt(h.assetId),
                        amount: toBigInt(h.amount),
                        isFrozen: h.isFrozen,
                    })),
            }
        },
        staleTime: Infinity,
    })

    return {
        data: query.data,
        isPending: query.isPending,
        isLoading: query.isLoading,
        isSuccess: query.isSuccess,
    }
}
