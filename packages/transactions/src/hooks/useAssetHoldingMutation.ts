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
import {
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import {
    useMinimumFeeCalculator,
    useSignAndSubmitGroup,
    type SignAndSubmitGroupParams,
} from '@perawallet/wallet-core-signing'
import { invalidateAccountQueriesForAddresses } from '@perawallet/wallet-core-accounts'
import { mutationDefaults, toError } from '@perawallet/wallet-core-shared'

import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'

type AlgorandClient = ReturnType<typeof useAlgorandClient>
type GroupComposer = ReturnType<AlgorandClient['newGroup']>

export type AssetHoldingMutationContext = {
    algokit: AlgorandClient
    network: Network
    /** Composes a group and returns it with the sender's minimum fee applied. */
    buildGroup: (
        addTransactions: (composer: GroupComposer) => void,
    ) => Promise<PeraTransaction[]>
    submit: (unsignedTxs: PeraTransaction[]) => Promise<{ txIds: string[] }>
}

export type AssetHoldingMutationOutcome = {
    txIds: string[]
    /** Account whose cached reads are invalidated once `run` resolves. */
    sender: string
}

type UseAssetHoldingMutationOptions<TParams> = {
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
 * Shared flow for asset opt-in and opt-out: `run` validates, builds via
 * `buildGroup`, submits and reconciles the local DB; this hook then
 * invalidates the sender's account reads.
 */
export const useAssetHoldingMutation = <TParams>({
    source,
    run,
}: UseAssetHoldingMutationOptions<TParams>): UseAssetHoldingMutationResult<TParams> => {
    const algokit = useAlgorandClient()
    const { submit } = useSignAndSubmitGroup()
    const { assignFeeToGroup } = useMinimumFeeCalculator()
    const { network } = useNetwork()
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
                    algokit,
                    network,
                    buildGroup: async addTransactions => {
                        const composer = algokit.newGroup()
                        addTransactions(composer)
                        const { transactions } = await composer.build()
                        // AlgoKit sizes fees for an Ed25519 envelope; a Falcon
                        // signer needs the PQ minimum or algod rejects the
                        // whole group (`txgroup with 1mA fees is less than
                        // 3mA`). Non-quantum senders pass through untouched.
                        const { transactions: unsignedTxs } =
                            await assignFeeToGroup({
                                transactions: transactions.map(t => t.txn),
                            })
                        return unsignedTxs
                    },
                    submit: unsignedTxs => submit({ unsignedTxs, source }),
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
