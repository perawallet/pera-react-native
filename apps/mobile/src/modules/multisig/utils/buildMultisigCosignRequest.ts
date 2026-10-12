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
    legacyNetworkOf,
    type ChainScope,
    type PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import {
    chainAccountOf,
    authorityOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    multisigAdapterFor,
    type MultisigSignRequest,
} from '@perawallet/wallet-core-multisig'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'

type BuildMultisigCosignRequestParams = {
    signRequest: MultisigSignRequest
    signerAddress: string
    scope: ChainScope
    decodeTransaction: (bytes: Uint8Array) => PeraTransaction
    /** Used to recognise senders the joint account authorizes via a rekey. */
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
    scope,
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

    // The backend is a relay, not a trust anchor, for what we sign.
    const { address } = signRequest.multisigAccount
    const jointAuthorizedSenders = new Set([
        address,
        ...localAccounts
            .filter(account => authorityOf(account, scope) === address)
            .flatMap(
                account =>
                    chainAccountOf(account, scope.chainId)?.address ?? [],
            ),
    ])
    const validation = multisigAdapterFor(
        legacyNetworkOf(scope),
    ).validateSignRequest(signRequest, jointAuthorizedSenders)
    switch (validation.kind) {
        case 'valid': {
            break
        }
        case 'address-mismatch': {
            throw new Error(
                `Sign request ${signRequest.id}: joint account address does not derive from its participant set`,
            )
        }
        case 'no-transactions': {
            throw new Error(
                `Sign request ${signRequest.id} has no transaction lists`,
            )
        }
        case 'unauthorized-sender': {
            throw new Error(
                `Sign request ${signRequest.id}: transaction ${validation.txIndex} is not authorized by the joint account ${address}`,
            )
        }
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
        chainId: scope.chainId,
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
