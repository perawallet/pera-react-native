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

import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
import {
    decodeFromBase64,
    generateOrderedUniqueId,
} from '@perawallet/wallet-core-shared'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'

type BuildMultisigCosignRequestParams = {
    signRequest: MultisigSignRequest
    signerAddress: string
    decodeTransaction: (bytes: Uint8Array) => PeraTransaction
}

/**
 * Builds a `TransactionSignRequest` for cosigning an existing multisig sign
 * request. Decodes the first transaction list's raw base64 transactions into
 * `PeraTransaction[]` and stamps `sourceType: 'multisig-cosign'` plus
 * `signRequestId` so the queue routes through the cosign transport.
 */
export const buildMultisigCosignRequest = ({
    signRequest,
    signerAddress,
    decodeTransaction,
}: BuildMultisigCosignRequestParams): TransactionSignRequest => {
    const transactionList = signRequest.transactionLists[0]
    if (!transactionList) {
        throw new Error(
            `Sign request ${signRequest.id} has no transaction lists`,
        )
    }

    const rawTransactionsBase64 = transactionList.rawTransactions
    const txs = rawTransactionsBase64.map(base64 =>
        decodeTransaction(decodeFromBase64(base64)),
    )

    return {
        // A real id is required so the actor map, queue dedup, and inline-
        // error guards in SignRequestView keep cosign requests distinct.
        // The lifecycle hooks fall back to `??` (null-coalescing), which
        // doesn't substitute for empty strings — handing in a real id here
        // is the only reliable place to do it.
        id: generateOrderedUniqueId(),
        type: 'transactions',
        transport: 'callback',
        // `sourceType: 'multisig-cosign'` is in `INTERACTIVE_SOURCES`, so
        // the standard review flow shows the review sheet automatically
        // and the local signer can see the proposed transactions before
        // adding their signature.
        sourceType: 'multisig-cosign',
        signRequestId: signRequest.id,
        txs,
        rawTransactionsBase64,
        signerOverrides: new Map(
            txs.map((_, index) => [index, signerAddress] as const),
        ),
    }
}
