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

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    useAlgorandClient,
    getAccountInformationQueryKey,
} from '@perawallet/wallet-core-blockchain'
import {
    validateSignerBalances,
    type AccountOnChainState,
    type BalanceValidationResult,
} from '../utils/balance-validation'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseBalanceValidationParams = {
    transactions: PeraDisplayableTransaction[]
    signableAddresses: Set<string>
    includeMBR?: boolean
}

type UseBalanceValidationResult = {
    validation: Nullable<BalanceValidationResult>
    isLoading: boolean
}

export const useBalanceValidation = (
    params: UseBalanceValidationParams,
): UseBalanceValidationResult => {
    const { transactions, signableAddresses, includeMBR } = params
    const algokit = useAlgorandClient()

    const addresses = useMemo(
        () => Array.from(signableAddresses),
        [signableAddresses],
    )

    const queries = useMemo(
        () =>
            addresses.map(address => ({
                queryKey: getAccountInformationQueryKey(address),
                queryFn: async (): Promise<AccountOnChainState> => {
                    const info = await algokit.client.algod
                        .accountInformation(address)
                        .do()
                    return {
                        address: info.address.toString(),
                        amount: info.amount,
                        minBalance: info.minBalance,
                        assets: (info.assets ?? []).map(a => ({
                            assetId: a.assetId,
                            amount: a.amount,
                        })),
                    }
                },
            })),
        [addresses, algokit],
    )

    const results = useQueries({ queries })

    const isLoading = results.some(r => r.isPending)

    const validation = useMemo(() => {
        if (isLoading) return null

        const accountStates = new Map<string, AccountOnChainState>()
        for (let i = 0; i < addresses.length; i++) {
            const data = results[i].data
            if (data) {
                accountStates.set(addresses[i], data)
            }
        }

        return validateSignerBalances(
            transactions,
            signableAddresses,
            accountStates,
            includeMBR,
        )
    }, [
        isLoading,
        results,
        addresses,
        transactions,
        signableAddresses,
        includeMBR,
    ])

    return { validation, isLoading }
}
