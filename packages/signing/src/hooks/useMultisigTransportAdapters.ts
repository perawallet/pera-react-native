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

        // Index multisig accounts by address for O(1) lookup. Recomputed
        // when the accounts list changes; stable identity otherwise so the
        // returned `getMsigMetadata` doesn't churn the transport selector.
        //
        // `version` is fixed to 1 because the local MultiSigDetails model
        // doesn't carry it — pera creates multisig accounts at v1 (see
        // `useNameMultisigScreen.ts` calling `generateMultisigAddress(1, ...)`).
        // Algorand's multisig spec has only ever had version 1; if that
        // changes upstream, plumb the version through the model and read
        // it here instead of hardcoding.
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

                // Mirrors Android: propose carries only the proposer's signature;
                // any additional local-key participants are added incrementally
                // via cosign calls. Keeps the wire pattern identical to what the
                // backend has been tested with and isolates per-signer failures
                // (a flaky cosign won't fail the whole flow — the propose has
                // already succeeded).
                const [proposer, ...cosigners] = signers
                // Raw msgpack bytes WITHOUT the "TX" domain-separation prefix.
                // The backend re-applies the prefix when verifying signatures,
                // so the wire payload must be the unprefixed transaction.
                // Mirrors the hardware-wallet flow in useSigningActorLifecycle
                // (Ledger likewise gets raw bytes because it adds the prefix
                // on-device).
                const rawTransactionsBase64 = signedData.signed.map(stx =>
                    encodeToBase64(encodeTransactionRaw(stx.txn)),
                )

                const proposeParams: ProposeSignRequest = {
                    joint_account_address: multisigAddress,
                    proposer_address: proposer.address,
                    // `'sync'` for WC / webview / deeplink handoffs — tells
                    // the backend "wallet will deliver; don't broadcast
                    // yourself". `'async'` for in-app Send / inbox-driven
                    // flows where the backend (eventually) broadcasts.
                    type,
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
                // error eats their signature here. We keep the latest
                // successful response so the cache stays in sync with the
                // most-up-to-date signer state without needing a GET refetch.
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
                        // Best-effort: failure doesn't bubble; user can re-cosign from inbox
                    }
                }

                // Pre-populate the detail query cache so
                // PendingSignaturesBottomSheet renders immediately when the
                // post-Send listener opens it. The GET `/with-signatures/`
                // endpoint is unreliable on some environments, so an
                // invalidation alone can leave the sheet stuck on its
                // loading spinner.
                queryClient.setQueryData(
                    getSignRequestDetailQueryKey(network, signRequestId),
                    latestResponse,
                )

                return { signRequestId, status: latestResponse.status }
            },
            [encodeTransactionRaw, network, queryClient],
        )

        const addSignatures = useCallback<AddSignaturesFn>(
            async ({ signRequestId, signers }) => {
                // Deferred-propose first-sig: the signRequestId is a local
                // draft id (no backend record exists yet). Bootstrap the
                // real propose using this single signer's signature, then
                // hand the real id back to the transport so the sheet
                // swaps from draft → real.
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
                    queryClient.setQueryData(
                        getSignRequestDetailQueryKey(
                            network,
                            proposeResponse.id,
                        ),
                        proposeResponse,
                    )
                    // The draft is deleted by `useMultisigProposeListener`
                    // atomically with `openSheet(realId)` so the next render
                    // observes both updates together (no draft-deleted →
                    // real-not-set flicker).
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
                // Pre-populate the detail query cache with the cosign
                // response so the PendingSignaturesBottomSheet renders the
                // updated signer state immediately. The GET refetch endpoint
                // (`/with-signatures/`) is unreliable on some environments,
                // so relying on `invalidateQueries` alone leaves the sheet
                // stuck on the loading spinner. Cache shape matches: both
                // `proposeSignRequestResponseSchema` and
                // `signRequestDetailResponseSchema` alias the same
                // `signRequestResponseSchema`.
                queryClient.setQueryData(
                    getSignRequestDetailQueryKey(network, signRequestId),
                    response,
                )
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
