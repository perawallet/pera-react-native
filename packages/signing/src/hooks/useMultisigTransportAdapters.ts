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

import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
    useNetwork,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    isMultisigAccount,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { useDeviceID } from '@perawallet/wallet-core-device'
import {
    addSignature,
    getSignRequestDetailQueryKey,
    isDraftSignRequestId,
    proposeSignRequest as proposeSignRequestApi,
    useDraftSignRequestStore,
    type ProposeSignRequest,
} from '@perawallet/wallet-core-multisig'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type {
    CreateDraftSignRequestFn,
    GetDeviceIdFn,
    GetMsigMetadataFn,
    MsigMetadata,
    ProposeSignRequestFn,
} from '../pipeline/transports/createMultisigProposeTransport'
import type { AddSignaturesFn } from '../pipeline/transports/createMultisigCosignTransport'
import type { SigningResult } from '../pipeline/types'

type UseMultisigTransportAdaptersResult = {
    /** Adapter for createMultisigProposeTransport */
    proposeSignRequest: ProposeSignRequestFn
    /** Adapter for createMultisigCosignTransport */
    addSignatures: AddSignaturesFn
    /**
     * Resolves multisig metadata for a given account address. Required by
     * the propose transport so the resolver listener can assemble the
     * composite multisig signed transaction (subsig order depends on the
     * canonical participant addresses).
     */
    getMsigMetadata: GetMsigMetadataFn
    /**
     * Returns the persistent device id for the current network, used by
     * the `with-signatures` and `mark-confirmed` API calls. May be
     * undefined briefly during app startup before the device is
     * registered; the propose transport throws in that case.
     */
    getDeviceId: GetDeviceIdFn
    /**
     * Creates a local draft sign-request when the propose transport
     * receives an empty signers array (the deferred-propose / hardware-only
     * proposer case). The first per-row Sign tap in the pending sheet
     * bootstraps the real backend propose via the cosign adapter's
     * draft-prefix branch.
     */
    createDraftSignRequest: CreateDraftSignRequestFn
}

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
        const { encodeTransactionRaw } = useTransactionEncoder()
        const queryClient = useQueryClient()
        const allAccounts = useAllAccounts()
        const deviceId = useDeviceID(network)

        const getDeviceId = useCallback<GetDeviceIdFn>(
            () => deviceId ?? undefined,
            [deviceId],
        )

        // Stable identity between accounts-list changes, so `getMsigMetadata`
        // doesn't churn the transport selector.
        //
        // `version` is hardcoded because MultiSigDetails doesn't carry it and
        // Algorand's multisig spec has only ever had version 1. If that changes
        // upstream, plumb the version through the model instead.
        const msigByAddress = useMemo(() => {
            const map = new Map<string, MsigMetadata>()
            for (const a of allAccounts) {
                if (!isMultisigAccount(a)) continue
                if (!a.multisigDetails) continue
                map.set(a.address, {
                    version: 1,
                    threshold: a.multisigDetails.threshold,
                    addresses: a.multisigDetails.addresses,
                })
            }
            return map
        }, [allAccounts])

        const getMsigMetadata = useCallback<GetMsigMetadataFn>(
            (address: string) => msigByAddress.get(address),
            [msigByAddress],
        )

        const proposeSignRequest = useCallback<ProposeSignRequestFn>(
            async ({ multisigAddress, signedData, signers, type }) => {
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

                // Mirrors Android: propose carries only the proposer's
                // signature, additional participants cosign incrementally. Keeps
                // the wire pattern the backend was tested against and isolates
                // per-signer failures from the already-succeeded propose.
                const [proposer, ...cosigners] = signers
                // No "TX" domain-separation prefix — the backend re-applies it
                // when verifying, so the wire payload must be unprefixed. Same
                // as Ledger, which adds the prefix on-device.
                const rawTransactionsBase64 = signedData.signed.map(stx =>
                    encodeToBase64(encodeTransactionRaw(stx.txn)),
                )

                const proposeParams: ProposeSignRequest = {
                    joint_account_address: multisigAddress,
                    proposer_address: proposer.address,
                    // `'sync'` tells the backend "the wallet delivers, don't
                    // broadcast" (external handoffs); `'async'` lets it broadcast
                    // (in-app Send / inbox flows).
                    type,
                    raw_transaction_lists: [rawTransactionsBase64],
                    responses: buildResponses([proposer]),
                }

                const proposeResponse = await proposeSignRequestApi(
                    network,
                    proposeParams,
                )
                const signRequestId = proposeResponse.id

                // Best-effort: the propose already succeeded, and a swallowed
                // cosign can be retried from the inbox. Keeping the latest
                // successful response keeps the cache current without a GET.
                let latestResponse: typeof proposeResponse = proposeResponse
                for (const cosigner of cosigners) {
                    try {
                        const cosignResponse = await addSignature(
                            network,
                            signRequestId,
                            buildResponses([cosigner]),
                        )
                        latestResponse = cosignResponse
                    } catch {
                        // Retryable from the inbox, so don't bubble.
                    }
                }

                // Seeded rather than invalidated: the GET `/with-signatures/`
                // endpoint is unreliable on some environments and leaves the
                // sheet stuck on its spinner.
                //
                // `proposer_address` is backfilled from the request because the
                // response declares it optional and some deployments echo null.
                // It gates the "Cancel transaction" button, so losing it strips
                // the user's ability to cancel their own proposal.
                queryClient.setQueryData(
                    getSignRequestDetailQueryKey(network, signRequestId),
                    {
                        ...latestResponse,
                        proposer_address:
                            latestResponse.proposer_address ?? proposer.address,
                    },
                )

                return {
                    signRequestId,
                    status: latestResponse.status,
                    rawTransactionsBase64,
                    // From the request, not the response, for the same reason
                    // the cache seed backfills it above.
                    proposerAddress: proposer.address,
                }
            },
            [encodeTransactionRaw, network, queryClient],
        )

        const addSignatures = useCallback<AddSignaturesFn>(
            async ({ signRequestId, signers }) => {
                // The signRequestId here is a local draft — no backend record
                // exists yet. Bootstrap the real propose from this signature and
                // hand the real id back so the sheet swaps draft -> real.
                if (isDraftSignRequestId(signRequestId)) {
                    const draft = useDraftSignRequestStore
                        .getState()
                        .getDraft(signRequestId)
                    if (!draft) {
                        throw new Error(
                            `Draft sign request ${signRequestId} not found — it was already swapped or cleared`,
                        )
                    }
                    const proposer = signers[0]
                    if (!proposer) {
                        throw new Error(
                            'Draft propose bootstrap requires a signer',
                        )
                    }
                    const proposeParams: ProposeSignRequest = {
                        joint_account_address: draft.multisigAddress,
                        proposer_address: proposer.address,
                        type: draft.proposeType,
                        raw_transaction_lists: [draft.rawTransactionsBase64],
                        responses: buildResponses([proposer]),
                    }
                    const proposeResponse = await proposeSignRequestApi(
                        network,
                        proposeParams,
                    )
                    // Backfilled for the reason given on the propose path above.
                    queryClient.setQueryData(
                        getSignRequestDetailQueryKey(
                            network,
                            proposeResponse.id,
                        ),
                        {
                            ...proposeResponse,
                            proposer_address:
                                proposeResponse.proposer_address ??
                                proposer.address,
                        },
                    )
                    // `useMultisigProposeListener` deletes the draft atomically
                    // with `openSheet(realId)`, so no draft-deleted-but-real-not-
                    // set flicker.
                    return {
                        status: proposeResponse.status,
                        resolvedSignRequestId: proposeResponse.id,
                    }
                }

                const responses = buildResponses(signers)
                const response = await addSignature(
                    network,
                    signRequestId,
                    responses,
                )
                // Seeded rather than invalidated, same as the propose path.
                // Shapes match — both schemas alias `signRequestResponseSchema`.
                //
                // `proposer_address` falls back to the cached value because
                // addSignature doesn't always echo it; without this every cosign
                // would wipe the pointer and strip the proposer's Cancel button.
                const cacheKey = getSignRequestDetailQueryKey(
                    network,
                    signRequestId,
                )
                const previousCachedResponse =
                    queryClient.getQueryData<typeof response>(cacheKey)
                queryClient.setQueryData(cacheKey, {
                    ...response,
                    proposer_address:
                        response.proposer_address ??
                        previousCachedResponse?.proposer_address ??
                        null,
                })
                return { status: response.status }
            },
            [network, queryClient],
        )

        const createDraftSignRequest = useCallback<CreateDraftSignRequestFn>(
            input => {
                const msig = msigByAddress.get(input.multisigAddress)
                if (!msig) {
                    throw new Error(
                        `Multisig metadata not found for address ${input.multisigAddress}; cannot create draft sign request`,
                    )
                }
                const rawTransactionsBase64 = input.signedTransactions.map(
                    stx => encodeToBase64(encodeTransactionRaw(stx.txn)),
                )
                return useDraftSignRequestStore.getState().createDraft({
                    network,
                    multisigAddress: input.multisigAddress,
                    multisigDetails: {
                        threshold: msig.threshold,
                        version: msig.version,
                        participantAddresses: msig.addresses,
                    },
                    rawTransactionsBase64,
                    proposeType: input.proposeType,
                })
            },
            [encodeTransactionRaw, msigByAddress, network],
        )

        return {
            proposeSignRequest,
            addSignatures,
            getMsigMetadata,
            getDeviceId,
            createDraftSignRequest,
        }
    }
