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
import { useQueryClient } from '@tanstack/react-query'
import {
    useAlgorandClient,
    useMinimumFeeConfig,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import {
    useMinimumFeeCalculator,
    useSignAndSubmitGroup,
} from '@perawallet/wallet-core-signing'
import {
    insertAssetHolding,
    invalidateAccountQueriesForAddresses,
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
    const { assignFeeToGroup } = useMinimumFeeCalculator()
    const { network } = useNetwork()
    const queryClient = useQueryClient()
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

                const composer = algokit.newGroup()
                composer.addAssetOptIn({ sender, assetId })
                const { transactions } = await composer.build()
                // Same PQ minimum as the opt-out path: AlgoKit sizes the fee
                // for an Ed25519 envelope, which algod rejects for a Falcon
                // signer (PERA-4922). See useAssetOptOutMutation.
                const { transactions: unsignedTxs } = await assignFeeToGroup({
                    transactions: transactions.map(t => t.txn),
                })

                // Check against the fee actually being submitted: reading it
                // back off the built group is what keeps a quantum sender's
                // higher fee from passing a check that algod then fails.
                const feeTotal = unsignedTxs.reduce(
                    (total, txn) => total + txn.fee,
                    0n,
                )
                const balanceNeeded =
                    accountInfo.minBalance + assetMbr + feeTotal
                if (accountInfo.amount < balanceNeeded) {
                    throw new InsufficientBalanceForOptInError()
                }

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
                // Not balances-only: account reads (holdings page, NFT
                // gallery sort caches) cache over SQLite with staleTime:
                // Infinity, and the sync diff can't catch this write later —
                // the holding is already persisted (PERA-4845).
                invalidateAccountQueriesForAddresses(queryClient, [sender])

                return { txIds }
            } catch (err) {
                const error = toError(err)
                setError(error)
                throw error
            } finally {
                setIsLoading(false)
            }
        },
        [algokit, submit, assignFeeToGroup, network, queryClient, assetMbr],
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
