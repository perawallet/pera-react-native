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
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useTransactionSigner } from '@perawallet/wallet-core-signing'
import { fetchIndexerAssetDetails } from '@perawallet/wallet-core-assets'
import {
    deleteAssetHoldings,
    useAccountBalancesInvalidator,
} from '@perawallet/wallet-core-accounts'
import { NonZeroBalanceError, CreatorCannotOptOutError } from '../errors'

type AssetOptOutParams = {
    sender: string
    assetId: bigint
    /** Creator address. If omitted, it will be fetched from the indexer. */
    creator?: string
}

type UseAssetOptOutMutationResult = {
    optOut: (
        params: AssetOptOutParams | AssetOptOutParams[],
    ) => Promise<{ txIds: string[] }>
    isLoading: boolean
    isError: boolean
    error: Error | null
}

type ResolvedOptOutParams = {
    sender: string
    assetId: bigint
    creator: string
}

export const useAssetOptOutMutation = (): UseAssetOptOutMutationResult => {
    const { signTransactions } = useTransactionSigner()
    const algokit = useAlgorandClient(signTransactions)
    const { network } = useNetwork()
    const { invalidate: invalidateBalances } = useAccountBalancesInvalidator()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const resolveCreator = useCallback(
        async (params: AssetOptOutParams): Promise<ResolvedOptOutParams> => {
            if (params.creator) {
                return params as ResolvedOptOutParams
            }

            // Fetch creator from indexer
            const assetDetails = await fetchIndexerAssetDetails(
                String(params.assetId),
                network,
            )
            return {
                ...params,
                creator: assetDetails.asset.params.creator,
            }
        },
        [network],
    )

    const validateOptOut = (
        params: ResolvedOptOutParams,
        assets: Array<{ assetId: bigint; amount: bigint }>,
    ) => {
        // Creator cannot opt out of their own asset
        if (params.sender === params.creator) {
            throw new CreatorCannotOptOutError()
        }

        // Asset balance must be zero
        const holding = assets.find(a => a.assetId === params.assetId)
        if (holding && holding.amount !== 0n) {
            throw new NonZeroBalanceError()
        }
    }

    const optOut = useCallback(
        async (
            params: AssetOptOutParams | AssetOptOutParams[],
        ): Promise<{ txIds: string[] }> => {
            const rawList = Array.isArray(params) ? params : [params]

            if (rawList.length === 0) {
                return { txIds: [] }
            }

            setIsLoading(true)
            setError(null)

            try {
                // Resolve any missing creator addresses
                const paramsList = await Promise.all(
                    rawList.map(resolveCreator),
                )

                // All params in a batch must share the same sender
                const sender = paramsList[0].sender

                // Fetch account info for validation
                const accountInfo =
                    await algokit.client.algod.accountInformation(sender)
                const assets = accountInfo.assets ?? []

                // Validate all opt-outs before building transactions
                for (const p of paramsList) {
                    validateOptOut(p, assets)
                }

                // Build and send transaction group
                let txIds: string[]
                if (paramsList.length === 1) {
                    const p = paramsList[0]
                    const result = await algokit.send.assetTransfer({
                        sender: p.sender,
                        receiver: p.sender,
                        assetId: p.assetId,
                        amount: 0n,
                        closeAssetTo: p.creator,
                    })
                    txIds = result.txIds
                } else {
                    // Batch: use composer for atomic group
                    const composer = algokit.newGroup()
                    for (const p of paramsList) {
                        composer.addAssetTransfer({
                            sender: p.sender,
                            receiver: p.sender,
                            assetId: p.assetId,
                            amount: 0n,
                            closeAssetTo: p.creator,
                        })
                    }
                    const result = await composer.send()
                    txIds = result.txIds
                }

                // Remove opted-out assets from local DB and refresh UI
                await deleteAssetHoldings({
                    accountAddress: sender,
                    assetIds: paramsList.map(p => String(p.assetId)),
                    network,
                })
                invalidateBalances()

                return { txIds }
            } catch (err) {
                const error =
                    err instanceof Error ? err : new Error(String(err))
                setError(error)
                throw error
            } finally {
                setIsLoading(false)
            }
        },
        [algokit, resolveCreator, network, invalidateBalances],
    )

    return {
        optOut,
        isLoading,
        isError: error !== null,
        error,
    }
}

export type { AssetOptOutParams, UseAssetOptOutMutationResult }
