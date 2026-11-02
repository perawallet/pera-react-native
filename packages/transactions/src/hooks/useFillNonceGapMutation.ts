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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import {
    getReplaceableSubmissionAttempt,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { TransactionNotReplaceableError } from '../errors'
import { transferChainAdapters } from '../transfer-adapter'

export type FillNonceGapParams = {
    scope: ChainScope
    /** The pending transaction stuck behind the gap. */
    txId: string
}

export type UseFillNonceGapMutationResult = {
    /** Resolves once the fill is queued for review; the signing sheet reports what follows. */
    fill: (params: FillNonceGapParams) => Promise<void>
    isPending: boolean
}

export const useFillNonceGapMutation = (): UseFillNonceGapMutationResult => {
    const { addSignRequest } = useSigningRequest()

    const mutation = useMutation({
        mutationFn: async ({ scope, txId }: FillNonceGapParams) => {
            // Re-read: the gap may have filled, or the send settled, since the row was drawn.
            const attempt = await getReplaceableSubmissionAttempt({
                scope,
                txId,
            })
            const { findBlockingGap, buildGapFill } = transferChainAdapters.get(
                scope.chainId,
            )
            if (!attempt || !findBlockingGap || !buildGapFill) {
                throw new TransactionNotReplaceableError()
            }
            const request = { rawTransaction: attempt.rawTransaction }
            const sequence = await findBlockingGap(request, { scope })
            if (sequence === null) throw new TransactionNotReplaceableError()
            const txs = await buildGapFill({ ...request, sequence }, { scope })
            // Not a replacement of txId: the fill takes the empty number below it.
            addSignRequest({
                id: generateOrderedUniqueId(),
                type: 'transactions',
                transport: 'network',
                sourceType: 'replacement',
                txs,
            })
        },
    })

    return { fill: mutation.mutateAsync, isPending: mutation.isPending }
}
