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

import { toError, type Network } from '@perawallet/wallet-core-shared'
import {
    useNetworkStore,
    type PeraSignedTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { MultisigProposeMode } from '@perawallet/wallet-core-multisig'
import type {
    DataTransport,
    SigningResult,
    SourceMetadata,
    TransportResult,
    SignRequestStatus,
} from '../types'
import { isExternalCallbackSource } from '../types'
import { NetworkChangedError, TransportError } from '../errors'
import { walletConnectHandoffs } from '../walletConnectHandoffs'

/**
 * The transport supplies the propose `type` — sync for handoffs, async for
 * in-app — so the backend picks the right post-threshold behaviour.
 */
export type ProposeSignRequestFn = (params: {
    multisigAddress: string
    signedData: SigningResult['signedData']
    signers: SigningResult['signers']
    type: MultisigProposeMode
}) => Promise<{
    signRequestId: string
    status: SignRequestStatus
    /**
     * Pinned on the handoff so the resolver can refuse poll responses whose
     * bytes differ from what the user reviewed.
     */
    rawTransactionsBase64: string[]
}>

/** Multisig metadata needed by the resolver listener to build subsigs. */
export type MsigMetadata = {
    version: number
    threshold: number
    addresses: string[]
}

export type GetMsigMetadataFn = (
    multisigAddress: string,
) => MsigMetadata | undefined

/** Injected so this package doesn't depend on the app's device-id source. */
export type GetDeviceIdFn = () => string | undefined

/**
 * Everything a later per-row Sign tap needs to bootstrap the real propose from
 * one participant's signature.
 */
export type CreateDraftSignRequestInput = {
    multisigAddress: string
    /**
     * Unsigned: `.txn` is populated, `sig`/`msig` absent. Typed as signed only
     * because it comes straight from `SigningResult`. Only `.txn` is read, to
     * encode the unprefixed msgpack bytes the propose API expects.
     */
    signedTransactions: PeraSignedTransaction[]
    proposeType: MultisigProposeMode
    source: SourceMetadata
}

/**
 * Returns a synthetic `draft-`-prefixed id. Injected so this package doesn't
 * depend on the mobile draft store. Absent, the transport throws on empty
 * signers, preserving behaviour for callers that haven't opted in.
 */
export type CreateDraftSignRequestFn = (
    input: CreateDraftSignRequestInput,
) => string

/**
 * Two flows:
 *  - **In-app**: `type: 'async'` — the backend collects signatures and
 *    eventually broadcasts.
 *  - **External handoff**: `type: 'sync'` — the backend collects signatures but
 *    the WALLET delivers the assembled bytes to the dApp. The transport
 *    registers a pending handoff in {@link walletConnectHandoffs}, and an
 *    app-side resolver polls for threshold-met and fires the callback.
 *
 *
 * `capturedNetwork` is re-checked before submission, so a mid-flow network
 * switch aborts rather than creating the backend record on the wrong chain.
 */
export const createMultisigProposeTransport = (
    proposeSignRequest: ProposeSignRequestFn,
    capturedNetwork: Network,
    getMsigMetadata: GetMsigMetadataFn,
    getDeviceId: GetDeviceIdFn,
    createDraftSignRequest?: CreateDraftSignRequestFn,
): DataTransport => {
    return {
        send: async (
            result: SigningResult,
            source: SourceMetadata,
            multisigAddress?: string,
        ): Promise<TransportResult> => {
            if (!multisigAddress) {
                throw new TransportError(
                    'Multisig address is required for multisig propose transport',
                )
            }

            const liveNetwork = useNetworkStore.getState().network
            if (liveNetwork !== capturedNetwork) {
                throw new NetworkChangedError(capturedNetwork, liveNetwork)
            }

            const isExternal = isExternalCallbackSource(source.type)
            // `transportOptions.multisig.proposeMode` lets a local caller opt
            // into the sync protocol (backend collects sigs but does NOT
            // broadcast). Used by shared-account swaps: the proposer's device
            // assembles + submits. Falls back to the source-derived default.
            const proposeType: MultisigProposeMode =
                source.transportOptions?.multisig?.proposeMode ??
                (isExternal ? 'sync' : 'async')

            // An empty `signers` array is how `multisigSignerActor` signals a
            // hardware-only proposer. Create a local draft instead of calling
            // the backend; the first per-row Sign bootstraps the real propose.
            if (result.signers.length === 0) {
                if (!createDraftSignRequest) {
                    throw new TransportError(
                        'Multisig propose received empty signers but no draft creator was provided',
                    )
                }
                if (result.signedData.type !== 'transactions') {
                    throw new TransportError(
                        'Deferred propose is only supported for transaction signing',
                    )
                }
                const draftLocalId = createDraftSignRequest({
                    multisigAddress,
                    signedTransactions: result.signedData.signed,
                    proposeType,
                    source,
                })
                // Reuse the existing `'proposed'` transport result so the
                // app-side listener (`useMultisigProposeListener`) opens the
                // pending sheet without needing a new event type.
                return {
                    type: 'proposed',
                    signRequestId: draftLocalId,
                    status: 'pending',
                    sourceType: source.type,
                }
            }

            try {
                const response = await proposeSignRequest({
                    multisigAddress,
                    signedData: result.signedData,
                    signers: result.signers,
                    type: proposeType,
                })

                // The resolver delivers the assembled bytes once threshold is
                // met, choosing between `approveSignedBytes`, `error`, and
                // `softReject` (decline / expired) at terminal status.
                if (isExternal) {
                    const msig = getMsigMetadata(multisigAddress)
                    if (!msig) {
                        // A programmer error — the multisig should be locally
                        // known by now — so surface it to the peer and fail the
                        // transport rather than assembling without metadata.
                        const err = new Error(
                            `Multisig metadata not found for address ${multisigAddress}`,
                        )
                        void source.callbacks?.error?.(err).catch(() => {})
                        throw new TransportError(err.message, err)
                    }
                    const deviceId = getDeviceId()
                    if (!deviceId) {
                        const err = new Error(
                            'Device id not available; cannot register WC handoff',
                        )
                        void source.callbacks?.error?.(err).catch(() => {})
                        throw new TransportError(err.message, err)
                    }
                    walletConnectHandoffs.register({
                        signRequestId: response.signRequestId,
                        multisigAddress,
                        msigMetadata: msig,
                        expectedRawTransactionsBase64:
                            response.rawTransactionsBase64,
                        deviceId,
                        network: capturedNetwork,
                        callbacks: {
                            approveSignedBytes:
                                source.callbacks?.approveSignedBytes,
                            error: source.callbacks?.error,
                            reject: source.callbacks?.reject,
                        },
                        source,
                        registeredAt: Date.now(),
                    })
                }

                // Hands back the backend id and the exact bytes sent so the
                // caller can finish the flow at threshold. Best-effort: a throw
                // here must not fail a propose that already succeeded.
                try {
                    await source.callbacks?.onProposed?.({
                        signRequestId: response.signRequestId,
                        status: response.status,
                        rawTransactionsBase64: response.rawTransactionsBase64,
                    })
                } catch {
                    // Swallowed: the backend record exists; the resolver can
                    // still finish from a persisted handoff if one was written.
                }

                return {
                    type: 'proposed',
                    signRequestId: response.signRequestId,
                    status: response.status,
                    sourceType: source.type,
                }
            } catch (error) {
                if (error instanceof NetworkChangedError) throw error
                if (error instanceof TransportError) throw error
                const err = toError(error)
                throw new TransportError(err.message, err)
            }
        },
    }
}
