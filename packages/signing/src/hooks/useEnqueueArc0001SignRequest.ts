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
import {
    type Arc0001ResolveResult,
    type PeraSignedTransaction,
    type PeraTransaction,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    encodeToBase64,
    generateOrderedUniqueId,
    toError,
    type Nullable,
} from '@perawallet/wallet-core-shared'

import type { RejectReason, SourceType } from '../pipeline/types'
import type { SignRequestSource, TransactionSignRequest } from '../models'
import type { FeeAdjustment } from '../pipeline/sources'
import {
    FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER,
    FeeAdjustmentDeliveryError,
} from '../pipeline/errors'

import { useSigningRequest } from './useSigningRequest'
import {
    useMinimumFeeCalculator,
    type AssignFeeToGroup,
} from './useMinimumFeeCalculator'

export type ExternalSignTxnTransport = {
    sourceType: SourceType
    transportId: string
    sourceMetadata?: SignRequestSource
    /** SW/platform-observed origin (trusted, not dApp-asserted) — used for
     *  trust display and ARC-60 SIWA domain binding. */
    verifiedOrigin?: string
    // ARC-0001 response: an array of (SignedTxnStr | null), same length and
    // order as the original request. Returning a Promise lets transports
    // surface delivery failures through the signing pipeline (e.g. WC v1
    // bridge socket revival via `ensureConnectorReady`).
    respondWithResult: (result: Nullable<string>[]) => Promise<void> | void
    respondWithReject: () => void
    respondWithError: (error: Error) => void
    /**
     * Optional clean-reject path for multisig sync handoff. Called when the
     * pipeline finishes the propose flow via `softReject` — the dApp peer
     * is informed of the rejection without raising a connection-error
     * banner.
     */
    respondWithSoftReject?: (error: Error) => Promise<void> | void
}

export type EnqueueArc0001SignRequest = (
    resolved: Arc0001ResolveResult,
    transport: ExternalSignTxnTransport,
) => Promise<void>

// Bridges an ARC-0001 resolver result to the signing pipeline. Transports
// (WC, webview, future deeplinks) hand in the resolved subset plus a
// response interface; this hook builds the TransactionSignRequest,
// short-circuits when nothing is signable, and pads the eventual result
// back to the original length per the spec's slot-order contract.
//
// Fees: the group is always run through the minimum-fee calculator
// (`assignFeeToGroup`) before enqueueing so the user reviews final fees. A
// group needing no raise is a free no-op — same references, no network
// traffic, every field byte-identical to what the resolver produced.
export const useEnqueueArc0001SignRequest = (): EnqueueArc0001SignRequest => {
    const { addSignRequest, removeSignRequest } = useSigningRequest()
    const { encodeSignedTransaction, encodeTransactionRaw } =
        useTransactionEncoder()
    const { assignFeeToGroup } = useMinimumFeeCalculator()

    return useCallback(
        async (resolved, transport) => {
            const { allDecoded, toSign, signerOverrides } = resolved
            const totalLength = allDecoded.length

            if (toSign.length === 0) {
                void transport.respondWithResult(
                    new Array(totalLength).fill(null),
                )
                return
            }

            const indicesToSign = toSign.map(t => t.index)

            let assigned: Awaited<ReturnType<AssignFeeToGroup>>
            try {
                assigned = await assignFeeToGroup({
                    transactions: allDecoded,
                    signableIndices: indicesToSign,
                    signerOverrides:
                        signerOverrides.size > 0 ? signerOverrides : undefined,
                })
            } catch (err) {
                // Incoming group was invalid as received (stale/tampered
                // group ID). Surface it to the dApp; never enqueue.
                transport.respondWithError(toError(err))
                return
            }

            // No-raise path reproduces today's exact field values: full
            // payload as groupContext, the signable subset as txs, and the
            // dApp's original wire bytes passed through verbatim.
            let groupContext: PeraTransaction[] = allDecoded
            let txs: PeraTransaction[] = toSign.map(t => t.decoded)
            let rawTransactionsBase64 = toSign.map(t => t.walletTxn.txn)
            let feeAdjustments: FeeAdjustment[] | undefined

            if (assigned.adjustments.length > 0) {
                groupContext = assigned.transactions
                txs = indicesToSign.map(i => assigned.transactions[i])
                // Re-encode the signable subset from the modified group so
                // the wire bytes carry the raised fees and recomputed grp.
                // encodeTransactionRaw round-trips the resolver's decode
                // (see the spec's round-trip assertion).
                rawTransactionsBase64 = indicesToSign.map(i =>
                    encodeToBase64(
                        encodeTransactionRaw(assigned.transactions[i]),
                    ),
                )
                feeAdjustments = assigned.adjustments
            }

            const signRequest: TransactionSignRequest = {
                id: generateOrderedUniqueId(),
                type: 'transactions',
                transport: 'callback',
                sourceType: transport.sourceType,
                transportId: transport.transportId,
                sourceMetadata: transport.sourceMetadata,
                verifiedOrigin: transport.verifiedOrigin,
                txs,
                // Full payload so the pipeline can recompute the group hash;
                // `txs` is just the signable subset.
                groupContext,
                // Index map back into `groupContext` so the signing UI can
                // render the full atomic group while marking which slots
                // the wallet will sign.
                signableIndices: indicesToSign,
                rawTransactionsBase64,
                signerOverrides:
                    signerOverrides.size > 0 ? signerOverrides : undefined,
                feeAdjustments,
                approve: async (signed: Nullable<PeraSignedTransaction>[]) => {
                    const result: Nullable<string>[] = new Array(
                        totalLength,
                    ).fill(null)
                    signed.forEach((tx, i) => {
                        if (tx) {
                            result[indicesToSign[i]] = encodeToBase64(
                                encodeSignedTransaction(tx),
                            )
                        }
                    })
                    try {
                        await transport.respondWithResult(result)
                    } catch (err) {
                        // Only a fee-adjusted request gets the dApp-compat
                        // framing — an ordinary request's delivery failure
                        // propagates unchanged.
                        if (!feeAdjustments) {
                            throw err
                        }
                        throw new FeeAdjustmentDeliveryError(
                            `The dApp rejected or failed to accept the ${FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER} response`,
                            { cause: toError(err) },
                        )
                    }
                },
                // Multisig sync-flow delivery: assembled msig bytes are
                // already encoded with the original txn embedded verbatim
                // (so participant signatures verify on algod). Pad nulls
                // into the unsignable slots and hand straight to the
                // transport — no algosdk re-encode.
                approveSignedBytes: async (signedBytes: Uint8Array[]) => {
                    const result: Nullable<string>[] = new Array(
                        totalLength,
                    ).fill(null)
                    signedBytes.forEach((bytes, i) => {
                        const idx = indicesToSign[i]
                        if (idx === undefined || !bytes) return
                        result[idx] = encodeToBase64(bytes)
                    })
                    await transport.respondWithResult(result)
                },
                reject: async (reason: RejectReason = { kind: 'user' }) => {
                    if (
                        reason.kind === 'softReject' &&
                        transport.respondWithSoftReject
                    ) {
                        await transport.respondWithSoftReject(reason.error)
                        removeSignRequest(signRequest)
                        return
                    }
                    transport.respondWithReject()
                },
                error: async (err: Error) => {
                    transport.respondWithError(err)
                    removeSignRequest(signRequest)
                },
            } as TransactionSignRequest

            addSignRequest(signRequest)
        },
        [
            addSignRequest,
            removeSignRequest,
            encodeSignedTransaction,
            encodeTransactionRaw,
            assignFeeToGroup,
        ],
    )
}
