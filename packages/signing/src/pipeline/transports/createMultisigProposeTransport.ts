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

import type { Network } from '@perawallet/wallet-core-shared'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
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
 * Function type for proposing a multisig transaction to the backend.
 * The transport supplies the propose `type` (sync for WC handoffs,
 * async for in-app flows) so the backend can pick the right
 * post-threshold behavior.
 */
export type ProposeSignRequestFn = (params: {
    multisigAddress: string
    signedData: SigningResult['signedData']
    signers: SigningResult['signers']
    /** `'sync'` = wallet will deliver; `'async'` = backend handles it. */
    type: 'sync' | 'async'
}) => Promise<{ signRequestId: string; status: SignRequestStatus }>

/** Multisig metadata needed by the resolver listener to build subsigs. */
export type MsigMetadata = {
    version: number
    threshold: number
    addresses: string[]
}

export type GetMsigMetadataFn = (
    multisigAddress: string,
) => MsigMetadata | undefined

/**
 * Resolves the device ID used in `with-signatures` and `mark-confirmed`
 * requests. Injected so the signing pkg doesn't depend on whatever
 * device-id source the app uses.
 */
export type GetDeviceIdFn = () => string | undefined

/**
 * Creates a transport that proposes a new multisig transaction to the backend.
 * Used by two flows:
 *  - **Local (in-app)**: proposer's first send from a multisig account.
 *    Uses `type: 'async'` — backend collects sigs and (eventually) broadcasts.
 *  - **Sync-flow (WC / webview / deeplink)**: dApp sends sign-tx for a
 *    multisig sender. Uses `type: 'sync'` — backend collects sigs, and the
 *    wallet is responsible for delivering the assembled signed bytes to
 *    the dApp via WC `approveRequest`. The transport registers a pending
 *    handoff in {@link walletConnectHandoffs}; an app-side resolver hook
 *    polls for threshold-met and fires the WC `approve` callback.
 *
 * @param proposeSignRequest - Function to call the backend API.
 * @param capturedNetwork - Network active when the signing actor was created.
 *   Re-checked before submission — abort on mid-flow network switch so the
 *   backend record isn't created on the wrong chain.
 * @param getMsigMetadata - Resolves multisig metadata by address; needed
 *   downstream by the resolver to assemble subsigs in canonical order.
 * @param getDeviceId - Returns the persistent device id for backend calls.
 */
export const createMultisigProposeTransport = (
    proposeSignRequest: ProposeSignRequestFn,
    capturedNetwork: Network,
    getMsigMetadata: GetMsigMetadataFn,
    getDeviceId: GetDeviceIdFn,
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
            const proposeType: 'sync' | 'async' = isExternal ? 'sync' : 'async'

            try {
                const response = await proposeSignRequest({
                    multisigAddress,
                    signedData: result.signedData,
                    signers: result.signers,
                    type: proposeType,
                })

                // Sync-flow handoff: register a pending handoff so the
                // resolver can deliver the assembled signed bytes to the
                // dApp once threshold is met. The resolver decides between
                // `approveSignedBytes` (success), `error` (terminal failure),
                // and `reject({ kind: 'softReject', error })` (participant
                // decline / expired) when status becomes terminal.
                if (isExternal) {
                    const msig = getMsigMetadata(multisigAddress)
                    if (!msig) {
                        // Without metadata we can't assemble. This is a
                        // programmer error (multisig should be locally
                        // known by the time the transport runs); surface
                        // it via the WC `error` callback if available, and
                        // fail the transport so the user sees an inline
                        // error.
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

                return {
                    type: 'proposed',
                    signRequestId: response.signRequestId,
                    status: response.status,
                    sourceType: source.type,
                }
            } catch (error) {
                if (error instanceof NetworkChangedError) throw error
                if (error instanceof TransportError) throw error
                const err =
                    error instanceof Error ? error : new Error(String(error))
                throw new TransportError(err.message, err)
            }
        },
    }
}
