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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
    ChainScope,
    PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    useMinimumFeeCalculator,
    useSignAndSubmitGroup,
    type SignAndSubmitGroupParams,
} from '@perawallet/wallet-core-signing'
import { invalidateAccountQueriesForAddresses } from '@perawallet/wallet-core-accounts'
import {
    mutationDefaults,
    type Nullable,
    toError,
} from '@perawallet/wallet-core-shared'

export type AssetHoldingMutationContext = {
    scope: ChainScope
    /** Returns the built group with the sender's minimum fee applied. */
    assignFees: (unsignedTxs: PeraTransaction[]) => Promise<PeraTransaction[]>
    submit: (unsignedTxs: PeraTransaction[]) => Promise<{ txIds: string[] }>
}

export type AssetHoldingMutationOutcome = {
    txIds: string[]
    /** Account whose cached reads are invalidated once `run` resolves. */
    sender: string
}

type UseAssetHoldingMutationOptions<TParams> = {
    scope: ChainScope
    source: SignAndSubmitGroupParams['source']
    run: (
        params: TParams,
        context: AssetHoldingMutationContext,
    ) => Promise<AssetHoldingMutationOutcome>
}

export type UseAssetHoldingMutationResult<TParams> = {
    mutateAsync: (params: TParams) => Promise<{ txIds: string[] }>
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
}

/**
 * Shared flow for asset opt-in and opt-out: `run` validates, builds through
 * the chain adapter, applies `assignFees`, submits and reconciles the local
 * DB; this hook then invalidates the sender's account reads.
 */
export const useAssetHoldingMutation = <TParams>({
    scope,
    source,
    run,
}: UseAssetHoldingMutationOptions<TParams>): UseAssetHoldingMutationResult<TParams> => {
    const { submit } = useSignAndSubmitGroup()
    const { assignFeeToGroup } = useMinimumFeeCalculator(scope.chainId)
    const queryClient = useQueryClient()

    const mutation = useMutation<{ txIds: string[] }, Error, TParams>({
        // Pinned here, not left to the client defaults: this moves funds, so
        // it must fail fast offline rather than pause, and never re-sign on
        // retry. Callers handle the rejection from mutateAsync themselves.
        ...mutationDefaults,
        retry: false,
        mutationFn: async params => {
            try {
                const { txIds, sender } = await run(params, {
                    scope,
                    // A Falcon signer needs the PQ minimum or algod rejects
                    // the whole group (`txgroup with 1mA fees is less than
                    // 3mA`). Non-quantum senders pass through untouched.
                    assignFees: async unsignedTxs =>
                        (await assignFeeToGroup({ transactions: unsignedTxs }))
                            .transactions,
                    submit: unsignedTxs =>
                        submit({
                            chainId: scope.chainId,
                            unsignedTxs,
                            source,
                        }),
                })
                // Not balances-only: account reads (holdings page, NFT
                // gallery sort caches) cache over SQLite with staleTime:
                // Infinity, and the sync diff can't catch a holding change
                // that `run` has already persisted.
                invalidateAccountQueriesForAddresses(queryClient, [sender])
                return { txIds }
            } catch (err) {
                throw toError(err)
            }
        },
    })

    return {
        mutateAsync: mutation.mutateAsync,
        isLoading: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error ?? null,
    }
}
