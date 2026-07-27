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

import { useCallback, useState } from 'react'
import {
    useAlgorandClient,
    useMinimumFeeConfig,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useSignAndSubmitGroup } from '@perawallet/wallet-core-signing'
import {
    insertAssetHolding,
    useAccountBalancesInvalidator,
} from '@perawallet/wallet-core-accounts'
import { fetchAndPersistAssets } from '@perawallet/wallet-core-assets'
import { assertOnline, toError } from '@perawallet/wallet-core-shared'
import {
    AlreadyOptedInError,
    InsufficientBalanceForOptInError,
} from '../errors'

import type { Nullable } from '@perawallet/wallet-core-shared'

type AssetOptInParams = {
    sender: string
    assetId: bigint
}

type UseAssetOptInMutationResult = {
    optIn: (params: AssetOptInParams) => Promise<{ txIds: string[] }>
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
}

const SOURCE = {
    name: 'asset-opt-in',
    description: 'Opt in to an asset',
}

export const useAssetOptInMutation = (): UseAssetOptInMutationResult => {
    const algokit = useAlgorandClient()
    const { submit } = useSignAndSubmitGroup()
    const { network } = useNetwork()
    const { invalidate: invalidateBalances } = useAccountBalancesInvalidator()
    const { assetMbr } = useMinimumFeeConfig()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Nullable<Error>>(null)

    const optIn = useCallback(
        async (params: AssetOptInParams): Promise<{ txIds: string[] }> => {
            const { sender, assetId } = params
            setIsLoading(true)
            setError(null)

            try {
                assertOnline()

                const accountInfo = await algokit.client.algod
                    .accountInformation(sender)
                    .do()
                const isOptedIn = accountInfo.assets?.some(
                    a => a.assetId === assetId,
                )
                if (isOptedIn) {
                    throw new AlreadyOptedInError()
                }

                const suggestedParams = await algokit.getSuggestedParams()
                const balanceNeeded =
                    accountInfo.minBalance +
                    assetMbr +
                    BigInt(suggestedParams.minFee)
                if (accountInfo.amount < balanceNeeded) {
                    throw new InsufficientBalanceForOptInError()
                }

                const composer = algokit.newGroup()
                composer.addAssetOptIn({ sender, assetId })
                const { transactions } = await composer.build()
                const unsignedTxs = transactions.map(t => t.txn)

                const { txIds } = await submit({
                    unsignedTxs,
                    source: SOURCE,
                })

                // Add the new holding to local DB and ensure the asset's
                // metadata is persisted before invalidating, so the UI can
                // resolve the asset on its next render instead of waiting
                // for the next sync poll.
                const assetIdString = String(assetId)
                await insertAssetHolding({
                    accountAddress: sender,
                    assetId: assetIdString,
                    network,
                })
                await fetchAndPersistAssets([assetIdString], network)
                invalidateBalances()

                return { txIds }
            } catch (err) {
                const error = toError(err)
                setError(error)
                throw error
            } finally {
                setIsLoading(false)
            }
        },
        [algokit, submit, network, invalidateBalances, assetMbr],
    )

    return {
        optIn,
        isLoading,
        isError: error !== null,
        error,
    }
}

export {
    AlreadyOptedInError,
    InsufficientBalanceForOptInError,
} from '../errors'
export type { AssetOptInParams, UseAssetOptInMutationResult }
