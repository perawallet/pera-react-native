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

import { generateMultisigAddress } from '@perawallet/wallet-core-blockchain'
import {
    decodeFromBase64,
    generateOrderedUniqueId,
} from '@perawallet/wallet-core-shared'

import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
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

    // A cosignature is only ever a subsig of the joint (multisig) account, and
    // the backend is a relay — not a trust anchor — for what we sign. Two hard
    // checks close the standalone-single-sig drain (PERA-4711):
    const { address, version, threshold, participantAddresses } =
        signRequest.multisigAccount

    // 1. The joint account must actually derive from its own participant set.
    //    This pins `address` to a genuine multisig hash, so a fabricated
    //    request can't pass off a participant's *personal* address as the
    //    "joint account" (which would make check 2 vacuous).
    if (
        generateMultisigAddress(version, threshold, participantAddresses) !==
        address
    ) {
        throw new Error(
            `Sign request ${signRequest.id}: joint account address does not derive from its participant set`,
        )
    }

    // 2. No transaction may be sent by the co-signer themselves. That is the
    //    exact condition under which the local signer omits `sgnr`
    //    (`account.address === senderPublicKey` in useLocalKeyTransactionSigner),
    //    producing a plain Ed25519 signature that verifies standalone and
    //    drains the co-signer's own account — the multisig threshold provides
    //    no protection. Any other sender (the joint account, or an account
    //    rekeyed to it — see the sign-multisig-rekeyed integration test) still
    //    yields a subsig bound to `sgnr`, which is useless on its own.
    const offenderIndex = txs.findIndex(
        tx => tx.sender.toString() === signerAddress,
    )
    if (offenderIndex !== -1) {
        throw new Error(
            `Sign request ${signRequest.id}: transaction ${offenderIndex} is sent by the co-signer, not the joint account ${address}`,
        )
    }

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
