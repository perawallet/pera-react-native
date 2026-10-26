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

import { useMutation } from '@tanstack/react-query'
import type {
    ChainScope,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import {
    getReplaceableSubmissionAttempt,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { TransactionNotReplaceableError } from '../errors'
import {
    transferChainAdapters,
    type TransactionReplacementKind,
} from '../transfer-adapter'

export type ReplaceTransactionParams = {
    scope: ChainScope
    /** The pending transaction to re-price. */
    txId: string
    kind: TransactionReplacementKind
}

export type UseReplaceTransactionMutationResult = {
    /** Resolves once the replacement is queued for review; the signing sheet reports what follows. */
    replace: (params: ReplaceTransactionParams) => Promise<void>
    isPending: boolean
}

// The ledger's entry is the build-time summary; a status notice belongs to the record, never the rebuild.
const withoutNotice = ({
    notice: _notice,
    ...summary
}: TransactionSummary): TransactionSummary => summary

export const useReplaceTransactionMutation =
    (): UseReplaceTransactionMutationResult => {
        const { addSignRequest } = useSigningRequest()

        const mutation = useMutation({
            mutationFn: async ({
                scope,
                txId,
                kind,
            }: ReplaceTransactionParams): Promise<void> => {
                // Re-read: the attempt may have settled since the row was drawn.
                const attempt = await getReplaceableSubmissionAttempt({
                    scope,
                    txId,
                })
                const adapter = transferChainAdapters.get(scope.chainId)
                if (!attempt || !adapter.buildReplacement) {
                    throw new TransactionNotReplaceableError()
                }
                const txs = await adapter.buildReplacement(
                    {
                        kind,
                        rawTransaction: attempt.rawTransaction,
                        summary: attempt.historyEntry
                            ? withoutNotice(attempt.historyEntry.summary)
                            : undefined,
                    },
                    { scope },
                )
                addSignRequest({
                    id: generateOrderedUniqueId(),
                    type: 'transactions',
                    transport: 'network',
                    sourceType: 'replacement',
                    txs,
                    replacesTxId: txId,
                })
            },
        })

        return { replace: mutation.mutateAsync, isPending: mutation.isPending }
    }
