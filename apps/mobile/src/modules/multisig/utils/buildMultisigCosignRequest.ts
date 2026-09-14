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

import {
    generateMultisigAddress,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'

import {
    getAccountsRekeyedTo,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'

type BuildMultisigCosignRequestParams = {
    signRequest: MultisigSignRequest
    signerAddress: string
    decodeTransaction: (bytes: Uint8Array) => PeraTransaction
    /**
     * The wallet's own accounts, used by check 2 to recognise senders the
     * joint account authorizes through a rekey.
     */
    localAccounts: WalletAccount[]
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
    localAccounts,
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
    // checks close the standalone-single-sig drain:
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

    // 2. Every transaction must be authorized by the joint account itself:
    //    sent by it, or sent by a local account rekeyed to it. The guard is
    //    positive because the old "not sent by the co-signer" form was unsound:
    //    an Ed25519 signature covers `"TX" || txn` and `sgnr` is an envelope
    //    field that is NOT signed, so participant key S's signature stands
    //    alone as `{sig, sgnr: S, txn}` for ANY sender whose on-chain auth-addr
    //    is S — not only for `sender === S`. Listing what is allowed rejects
    //    that whole class, including senders this wallet has never seen, rather
    //    than the one shape we thought to name.
    //
    //    Rejecting an unknown sender outright (instead of resolving its
    //    auth-addr over the network) costs nothing real: the request signs
    //    every transaction with the participant key (`signerOverrides` below),
    //    so a sender the joint account does not authorize yields a signature
    //    that is either useless or dangerous.
    const jointAuthorizedSenders = new Set([
        address,
        ...getAccountsRekeyedTo(address, localAccounts).map(
            account => account.address,
        ),
    ])
    const offenderIndex = txs.findIndex(
        tx => !jointAuthorizedSenders.has(tx.sender.toString()),
    )
    if (offenderIndex !== -1) {
        throw new Error(
            `Sign request ${signRequest.id}: transaction ${offenderIndex} is not authorized by the joint account ${address}`,
        )
    }

    return {
        // Deterministic per (signRequestId, signer): a participant's cosignature
        // for a given request is a single unit of work, so re-dispatching the
        // same signer collapses on the store's id-dedup instead of stacking a
        // duplicate review sheet — this closes the same-tick double-tap race the
        // render-derived in-flight guard can't (both taps read a stale queue).
        // Distinct signers still get distinct ids, so the actor map and the
        // inline-error guards in SignRequestView keep cosigns apart as before.
        id: `${signRequest.id}:${signerAddress}`,
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
