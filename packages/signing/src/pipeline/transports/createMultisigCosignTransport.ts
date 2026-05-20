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

import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { toError, type Network } from '@perawallet/wallet-core-shared'
import type {
    DataTransport,
    SigningResult,
    SourceMetadata,
    TransportResult,
    SignRequestStatus,
} from '../types'
import { NetworkChangedError, TransportError } from '../errors'

/**
 * Function type for adding signatures to an existing multisig request
 */
export type AddSignaturesFn = (params: {
    signRequestId: string
    signers: SigningResult['signers']
}) => Promise<{ status: SignRequestStatus }>

/**
 * Creates a transport that adds signatures to an existing multisig request.
 * This is used when co-signing a transaction that was proposed by another participant.
 *
 * @param addSignatures - Function to call the backend API
 * @param capturedNetwork - Network active when the signing actor was created.
 *   Live network is re-checked before submission — if the user switched
 *   networks mid-flow we abort so cosign signatures aren't routed to the
 *   wrong backend (which would silently 404).
 */
export const createMultisigCosignTransport = (
    addSignatures: AddSignaturesFn,
    capturedNetwork: Network,
): DataTransport => {
    return {
        send: async (
            result: SigningResult,
            source: SourceMetadata,
            _multisigAddress?: string,
        ): Promise<TransportResult> => {
            if (!source.signRequestId) {
                throw new TransportError(
                    'Sign request ID is required for multisig co-sign transport',
                )
            }

            const liveNetwork = useNetworkStore.getState().network
            if (liveNetwork !== capturedNetwork) {
                throw new NetworkChangedError(capturedNetwork, liveNetwork)
            }

            try {
                const response = await addSignatures({
                    signRequestId: source.signRequestId,
                    signers: result.signers,
                })
                return {
                    type: 'signatures-added',
                    signRequestId: source.signRequestId,
                    status: response.status,
                }
            } catch (error) {
                if (error instanceof NetworkChangedError) throw error
                const err = toError(error)
                throw new TransportError(err.message, err)
            }
        },
    }
}
