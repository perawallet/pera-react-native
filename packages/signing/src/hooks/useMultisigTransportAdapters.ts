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

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
    useNetwork,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    addSignature,
    getSignRequestDetailQueryKey,
    proposeSignRequest as proposeSignRequestApi,
    type ProposeSignRequest,
} from '@perawallet/wallet-core-multisig'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { ProposeSignRequestFn } from '../pipeline/transports/createMultisigProposeTransport'
import type { AddSignaturesFn } from '../pipeline/transports/createMultisigCosignTransport'
import type { SigningResult } from '../pipeline/types'

type UseMultisigTransportAdaptersResult = {
    /** Adapter for createMultisigProposeTransport */
    proposeSignRequest: ProposeSignRequestFn
    /** Adapter for createMultisigCosignTransport */
    addSignatures: AddSignaturesFn
}

const SIGN_REQUEST_TYPE = 'async'

/**
 * Builds the per-signer responses array for both propose and cosign requests.
 * Each `SignerInfo.signatures` (base64-encoded per-txn sigs) becomes a single
 * inner array, mirroring the single-group shape produced by the pipeline.
 *
 * Returns the propose-flavored shape (signatures required) — `addSignature`'s
 * type accepts a wider shape (signatures optional), so the same payload works
 * for both endpoints.
 */
const buildResponses = (
    signers: SigningResult['signers'],
): ProposeSignRequest['responses'] =>
    signers.map(signer => ({
        address: signer.address,
        response: 'signed' as const,
        signatures: [signer.signatures ?? []],
    }))

/**
 * React-side adapters that translate the multisig transport's
 * `{ multisigAddress, signedData, signers }` / `{ signRequestId, signers }`
 * shapes into the backend `ProposeSignRequest` / `AddSignatureRequest`
 * schemas, then call the corresponding API.
 *
 * Returned callbacks are stable across renders so the transport selector in
 * useSigningActorLifecycle doesn't churn its identity per render.
 */
export const useMultisigTransportAdapters =
    (): UseMultisigTransportAdaptersResult => {
        const { network } = useNetwork()
        const { encodeTransaction } = useTransactionEncoder()
        const queryClient = useQueryClient()

        const proposeSignRequest = useCallback<ProposeSignRequestFn>(
            async ({ multisigAddress, signedData, signers }) => {
                if (signedData.type !== 'transactions') {
                    throw new Error(
                        `Multisig propose requires transaction data, got: ${signedData.type}`,
                    )
                }
                if (signers.length === 0) {
                    throw new Error(
                        'Multisig propose requires at least one signer',
                    )
                }

                // Mirrors Android: propose carries only the proposer's signature;
                // any additional local-key participants are added incrementally
                // via cosign calls. Keeps the wire pattern identical to what the
                // backend has been tested with and isolates per-signer failures
                // (a flaky cosign won't fail the whole flow — the propose has
                // already succeeded).
                const [proposer, ...cosigners] = signers
                const rawTransactionsBase64 = signedData.signed.map(stx =>
                    encodeToBase64(encodeTransaction(stx.txn)),
                )

                const proposeParams: ProposeSignRequest = {
                    joint_account_address: multisigAddress,
                    proposer_address: proposer.address,
                    type: SIGN_REQUEST_TYPE,
                    raw_transaction_lists: [rawTransactionsBase64],
                    responses: buildResponses([proposer]),
                }

                const proposeResponse = await proposeSignRequestApi(
                    network,
                    proposeParams,
                )
                const signRequestId = proposeResponse.id

                // Best-effort: each cosign is awaited but its failure doesn't
                // bubble. The propose succeeded; the user's other accounts can
                // still re-cosign later from the inbox if a transient backend
                // error eats their signature here. We keep the latest successful
                // status so the UI sees the most up-to-date state without an
                // extra round-trip.
                let latestStatus = proposeResponse.status
                for (const cosigner of cosigners) {
                    try {
                        const cosignResponse = await addSignature(
                            network,
                            signRequestId,
                            buildResponses([cosigner]),
                        )
                        latestStatus = cosignResponse.status
                    } catch (error) {
                        console.warn(
                            `Multisig cosign failed for ${cosigner.address}; sign request ${signRequestId} remains in propose-only state`,
                            error,
                        )
                    }
                }

                if (cosigners.length > 0) {
                    await queryClient.invalidateQueries({
                        queryKey: getSignRequestDetailQueryKey(
                            network,
                            signRequestId,
                        ),
                    })
                }

                return { signRequestId, status: latestStatus }
            },
            [encodeTransaction, network, queryClient],
        )

        const addSignatures = useCallback<AddSignaturesFn>(
            async ({ signRequestId, signers }) => {
                const responses = buildResponses(signers)
                const response = await addSignature(
                    network,
                    signRequestId,
                    responses,
                )
                await queryClient.invalidateQueries({
                    queryKey: getSignRequestDetailQueryKey(
                        network,
                        signRequestId,
                    ),
                })
                return { status: response.status }
            },
            [network, queryClient],
        )

        return { proposeSignRequest, addSignatures }
    }
