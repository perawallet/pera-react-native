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

import { useCallback } from 'react'
import { fetchIndexerAssetDetails } from '@perawallet/wallet-core-assets'
import { deleteAssetHoldings } from '@perawallet/wallet-core-accounts'
import { CreatorCannotOptOutError, NonZeroBalanceError } from '../errors'
import { useAssetHoldingMutation } from './useAssetHoldingMutation'

import type {
    Network,
    Nullable,
    Optional,
} from '@perawallet/wallet-core-shared'

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

const resolveCreator = async (
    params: AssetOptOutParams,
    network: Network,
): Promise<ResolvedOptOutParams> => {
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
}

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

export const useAssetOptOutMutation = (): UseAssetOptOutMutationResult => {
    const { mutateAsync, isLoading, isError, error } = useAssetHoldingMutation<
        AssetOptOutParams[]
    >({
        source: SOURCE,
        run: async (rawList, { algokit, network, buildGroup, submit }) => {
            const paramsList = await Promise.all(
                rawList.map(p => resolveCreator(p, network)),
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
                const unsignedTxs = await buildGroup(composer => {
                    for (const p of toSubmit) {
                        composer.addAssetTransfer({
                            sender: p.sender,
                            receiver: p.sender,
                            assetId: p.assetId,
                            amount: 0n,
                            closeAssetTo: p.creator,
                        })
                    }
                })
                const result = await submit(unsignedTxs)
                txIds = result.txIds
            }

            await deleteAssetHoldings({
                accountAddress: sender,
                assetIds: paramsList.map(p => String(p.assetId)),
                network,
            })

            return { txIds, sender }
        },
    })

    const optOut = useCallback(
        async (
            params: AssetOptOutParams | AssetOptOutParams[],
        ): Promise<{ txIds: string[] }> => {
            const rawList = Array.isArray(params) ? params : [params]
            // Resolved without starting the mutation, so an empty selection
            // never flips isLoading or clears a previous error.
            if (rawList.length === 0) {
                return { txIds: [] }
            }
            return mutateAsync(rawList)
        },
        [mutateAsync],
    )

    return {
        optOut,
        isLoading,
        isError,
        error,
    }
}

export { NonZeroBalanceError, CreatorCannotOptOutError } from '../errors'
export type { AssetOptOutParams, UseAssetOptOutMutationResult }
