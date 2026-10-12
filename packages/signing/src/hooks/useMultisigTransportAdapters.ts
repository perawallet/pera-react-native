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
import { useQueryClient } from '@tanstack/react-query'
import {
    legacyNetworkOf,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useNetwork } from '@perawallet/wallet-core-chain-shared'
import {
    addressOn,
    multisigParametersOf,
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
import {
    plannerAdapterForScope,
    type AddSignaturesFn,
    type CreateDraftSignRequestFn,
    type GetDeviceIdFn,
    type GetMsigMetadataFn,
    type MsigMetadata,
    type ProposeSignRequestFn,
} from '../chain-adapter'
import { walletConnectHandoffs } from '../pipeline/walletConnectHandoffs'
import { isExternalCallbackSource, type SigningResult } from '../pipeline/types'

export type MultisigTransportAdapters = {
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

type UseMultisigTransportAdaptersResult = {
    /** The adapters bound to the scope a request's transport captured. */
    adaptersFor: (scope: ChainScope) => MultisigTransportAdapters
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
        const { network: activeNetwork } = useNetwork()
        const queryClient = useQueryClient()
        const allAccounts = useAllAccounts()
        const deviceId = useDeviceID(activeNetwork)

        const getDeviceId = useCallback<GetDeviceIdFn>(
            () => deviceId ?? undefined,
            [deviceId],
        )

        // A record without stored parameters has no threshold or
        // participants to report, so it is left out rather than given a
        // default.
        const msigByAddressOn = useCallback(
            (scope: ChainScope) => {
                const map = new Map<string, MsigMetadata>()
                for (const a of allAccounts) {
                    const parameters = multisigParametersOf(a, scope.chainId)
                    const address = addressOn(a, scope)
                    if (!parameters || !address) continue
                    map.set(address, {
                        version: parameters.version,
                        threshold: parameters.threshold,
                        addresses: parameters.addresses,
                    })
                }
                return map
            },
            [allAccounts],
        )

        const proposeSignRequestOn = useCallback(
            (scope: ChainScope): ProposeSignRequestFn =>
                async ({ multisigAddress, signedData, signers, type }) => {
                    const network = legacyNetworkOf(scope)
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
                    // Unprefixed: the backend re-applies the signing-domain prefix
                    // when verifying, as a hardware device does on-device.
                    const rawTransactionsBase64 = signedData.signed.map(stx =>
                        encodeToBase64(
                            plannerAdapterForScope(
                                scope,
                            ).encodeUnsignedTransaction(stx.txn),
                        ),
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
                        getSignRequestDetailQueryKey(scope, signRequestId),
                        {
                            ...latestResponse,
                            proposer_address:
                                latestResponse.proposer_address ??
                                proposer.address,
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
            [queryClient],
        )

        const addSignaturesOn = useCallback(
            (scope: ChainScope): AddSignaturesFn =>
                async ({ signRequestId, signers }) => {
                    const network = legacyNetworkOf(scope)
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
                            raw_transaction_lists: [
                                draft.rawTransactionsBase64,
                            ],
                            responses: buildResponses([proposer]),
                        }
                        const proposeResponse = await proposeSignRequestApi(
                            network,
                            proposeParams,
                        )
                        // Backfilled for the reason given on the propose path above.
                        queryClient.setQueryData(
                            getSignRequestDetailQueryKey(
                                scope,
                                proposeResponse.id,
                            ),
                            {
                                ...proposeResponse,
                                proposer_address:
                                    proposeResponse.proposer_address ??
                                    proposer.address,
                            },
                        )
                        // The draft was created before any backend record existed,
                        // so the sync-flow delivery wiring the immediate-propose
                        // path does at create time happens here instead. Without
                        // it a `sync` record has no deliverer anywhere and the
                        // backend holds it at `ready` forever.
                        const context =
                            plannerAdapterForScope(
                                scope,
                            ).takeDraftProposeContext(signRequestId)
                        if (context) {
                            const { source, msigMetadata } = context
                            const handoffDeviceId = deviceId ?? context.deviceId
                            if (
                                isExternalCallbackSource(source.type) &&
                                msigMetadata &&
                                handoffDeviceId
                            ) {
                                walletConnectHandoffs.register({
                                    signRequestId: proposeResponse.id,
                                    multisigAddress: draft.multisigAddress,
                                    msigMetadata,
                                    expectedRawTransactionsBase64:
                                        draft.rawTransactionsBase64,
                                    deviceId: handoffDeviceId,
                                    scope,
                                    sourceType: source.type,
                                    registeredAt: Date.now(),
                                    proposerAddress: proposer.address,
                                    callbacks: {
                                        approveSignedBytes:
                                            source.callbacks
                                                ?.approveSignedBytes,
                                        error: source.callbacks?.error,
                                        reject: source.callbacks?.reject,
                                    },
                                    recovery: source.handoffDelivery,
                                })
                            }
                            // Best-effort, same contract as the propose transport:
                            // the backend record exists, so a listener failure must
                            // not fail the bootstrap that already succeeded.
                            try {
                                await source.callbacks?.onProposed?.({
                                    signRequestId: proposeResponse.id,
                                    status: proposeResponse.status,
                                    rawTransactionsBase64:
                                        draft.rawTransactionsBase64,
                                })
                            } catch {
                                // Swallowed: delivery can still finish from the
                                // registered handoff or the inbox flow.
                            }
                        }
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
                        scope,
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
            [queryClient, deviceId],
        )

        const createDraftSignRequestOn = useCallback(
            (scope: ChainScope): CreateDraftSignRequestFn =>
                input => {
                    const msig = msigByAddressOn(scope).get(
                        input.multisigAddress,
                    )
                    if (!msig) {
                        throw new Error(
                            `Multisig metadata not found for address ${input.multisigAddress}; cannot create draft sign request`,
                        )
                    }
                    const rawTransactionsBase64 = input.signedTransactions.map(
                        stx =>
                            encodeToBase64(
                                plannerAdapterForScope(
                                    scope,
                                ).encodeUnsignedTransaction(stx.txn),
                            ),
                    )
                    return useDraftSignRequestStore.getState().createDraft({
                        network: legacyNetworkOf(scope),
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
            [msigByAddressOn],
        )

        const adaptersFor = useCallback(
            (scope: ChainScope): MultisigTransportAdapters => {
                const msigByAddress = msigByAddressOn(scope)
                return {
                    proposeSignRequest: proposeSignRequestOn(scope),
                    addSignatures: addSignaturesOn(scope),
                    getMsigMetadata: address => msigByAddress.get(address),
                    getDeviceId,
                    createDraftSignRequest: createDraftSignRequestOn(scope),
                }
            },
            [
                msigByAddressOn,
                proposeSignRequestOn,
                addSignaturesOn,
                getDeviceId,
                createDraftSignRequestOn,
            ],
        )

        return { adaptersFor }
    }
