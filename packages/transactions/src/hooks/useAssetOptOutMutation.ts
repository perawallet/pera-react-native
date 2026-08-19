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
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import {
    useMinimumFeeCalculator,
    useSignAndSubmitGroup,
} from '@perawallet/wallet-core-signing'
import { fetchIndexerAssetDetails } from '@perawallet/wallet-core-assets'
import {
    deleteAssetHoldings,
    invalidateAccountQueriesForAddresses,
} from '@perawallet/wallet-core-accounts'
import { toError } from '@perawallet/wallet-core-shared'
import { CreatorCannotOptOutError, NonZeroBalanceError } from '../errors'

import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

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
    error: Nullable<Error>
}

type ResolvedOptOutParams = {
    sender: string
    assetId: bigint
    creator: string
}

const SOURCE = {
    name: 'asset-opt-out',
    description: 'Opt out of an asset',
}

export const useAssetOptOutMutation = (): UseAssetOptOutMutationResult => {
    const algokit = useAlgorandClient()
    const { submit } = useSignAndSubmitGroup()
    const { assignFeeToGroup } = useMinimumFeeCalculator()
    const { network } = useNetwork()
    const queryClient = useQueryClient()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Nullable<Error>>(null)

    const resolveCreator = useCallback(
        async (params: AssetOptOutParams): Promise<ResolvedOptOutParams> => {
            if (params.creator) {
                return params as ResolvedOptOutParams
            }
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

    // Hard validation only — throws on caller errors that must surface.
    // Whether a txn is actually needed (skip when the asset is already gone
    // on-chain) is a separate decision the caller makes via the holding
    // lookup; mixing both into one helper produced a confusing
    // returns-or-throws contract.
    const assertCanOptOut = (
        params: ResolvedOptOutParams,
        holding: Optional<{ assetId: bigint; amount: bigint }>,
    ): void => {
        if (params.sender === params.creator) {
            throw new CreatorCannotOptOutError()
        }
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
                const paramsList = await Promise.all(
                    rawList.map(resolveCreator),
                )

                const sender = paramsList[0].sender

                const accountInfo = await algokit.client.algod
                    .accountInformation(sender)
                    .do()
                const assets = accountInfo.assets ?? []

                // Skip txn-building for assets the chain shows as already
                // gone (a prior opt-out already settled and the local UI
                // is stale) — submitting again would be rejected as
                // `duplicate_txn`. We still reconcile local state below.
                const toSubmit = paramsList.filter(p => {
                    const holding = assets.find(a => a.assetId === p.assetId)
                    assertCanOptOut(p, holding)
                    return holding !== undefined
                })

                let txIds: string[] = []
                if (toSubmit.length > 0) {
                    const composer = algokit.newGroup()
                    for (const p of toSubmit) {
                        composer.addAssetTransfer({
                            sender: p.sender,
                            receiver: p.sender,
                            assetId: p.assetId,
                            amount: 0n,
                            closeAssetTo: p.creator,
                        })
                    }
                    const { transactions } = await composer.build()
                    // A Falcon signature makes the group cost more than the
                    // base minimum, and algod rejects the whole group when it
                    // is short: `txgroup with 1mA fees is less than 3mA
                    // (usage=3.000000 * base=1mA)`. AlgoKit sizes fees from an
                    // Ed25519 envelope, so the PQ minimum has to be applied
                    // here. Non-quantum senders pass through untouched
                    // (PERA-4922).
                    const { transactions: unsignedTxs } =
                        await assignFeeToGroup({
                            transactions: transactions.map(t => t.txn),
                        })

                    const result = await submit({
                        unsignedTxs,
                        source: SOURCE,
                    })
                    txIds = result.txIds
                }

                await deleteAssetHoldings({
                    accountAddress: sender,
                    assetIds: paramsList.map(p => String(p.assetId)),
                    network,
                })
                // Same as the opt-in: the delete must invalidate every
                // staleTime-Infinity account read; the sync diff won't see
                // the already-persisted change (PERA-4845).
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
        [
            algokit,
            resolveCreator,
            submit,
            assignFeeToGroup,
            network,
            queryClient,
        ],
    )

    return {
        optOut,
        isLoading,
        isError: error !== null,
        error,
    }
}

export { NonZeroBalanceError, CreatorCannotOptOutError } from '../errors'
export type { AssetOptOutParams, UseAssetOptOutMutationResult }
