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

import { useCallback, useState } from 'react'
import {
    ASSET_MBR,
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useTransactionSigner } from '@perawallet/wallet-core-signing'
import {
    insertAssetHolding,
    useAccountBalancesInvalidator,
} from '@perawallet/wallet-core-accounts'
import {
    AlreadyOptedInError,
    InsufficientBalanceForOptInError,
} from '../errors'

type AssetOptInParams = {
    sender: string
    assetId: bigint
}

type UseAssetOptInMutationResult = {
    optIn: (params: AssetOptInParams) => Promise<{ txIds: string[] }>
    isLoading: boolean
    isError: boolean
    error: Error | null
}

export const useAssetOptInMutation = (): UseAssetOptInMutationResult => {
    const { signTransactions } = useTransactionSigner()
    const algokit = useAlgorandClient(signTransactions)
    const { network } = useNetwork()
    const { invalidate: invalidateBalances } = useAccountBalancesInvalidator()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const optIn = useCallback(
        async (params: AssetOptInParams): Promise<{ txIds: string[] }> => {
            const { sender, assetId } = params
            setIsLoading(true)
            setError(null)

            try {
                // Check if already opted in
                const accountInfo =
                    await algokit.client.algod.accountInformation(sender)
                const isOptedIn = accountInfo.assets?.some(
                    a => a.assetId === assetId,
                )
                if (isOptedIn) {
                    throw new AlreadyOptedInError()
                }

                // Check balance covers MBR increase + fee
                const suggestedParams = await algokit.getSuggestedParams()
                const balanceNeeded =
                    accountInfo.minBalance + ASSET_MBR + suggestedParams.minFee
                if (accountInfo.amount < balanceNeeded) {
                    throw new InsufficientBalanceForOptInError()
                }

                const result = await algokit.send.assetOptIn({
                    sender,
                    assetId,
                })

                // Add the new holding to local DB and refresh UI
                await insertAssetHolding({
                    accountAddress: sender,
                    assetId: String(assetId),
                    network,
                })
                invalidateBalances()

                return { txIds: result.txIds }
            } catch (err) {
                const error =
                    err instanceof Error ? err : new Error(String(err))
                setError(error)
                throw error
            } finally {
                setIsLoading(false)
            }
        },
        [algokit, network, invalidateBalances],
    )

    return {
        optIn,
        isLoading,
        isError: error !== null,
        error,
    }
}

export type { AssetOptInParams, UseAssetOptInMutationResult }
