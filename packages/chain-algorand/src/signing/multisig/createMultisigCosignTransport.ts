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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { assertScopeUnchanged } from '@perawallet/wallet-core-chain-shared'
import { toError } from '@perawallet/wallet-core-shared'
import {
    TransportError,
    type AddSignaturesFn,
    type DataTransport,
    type SigningResult,
    type SourceMetadata,
    type TransportResult,
} from '@perawallet/wallet-core-signing'

/**
 * Creates a transport that adds signatures to an existing multisig request.
 * This is used when co-signing a transaction that was proposed by another participant.
 *
 * @param addSignatures - Function to call the backend API
 * @param capturedScope - Re-checked with `assertScopeUnchanged` before
 *   submitting: the wrong network's backend would silently 404 the cosign.
 */
export const createMultisigCosignTransport = (
    addSignatures: AddSignaturesFn,
    capturedScope: ChainScope,
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

            assertScopeUnchanged(capturedScope)

            try {
                const response = await addSignatures({
                    signRequestId: source.signRequestId,
                    signers: result.signers,
                })
                return {
                    type: 'signatures-added',
                    // The adapter returns `resolvedSignRequestId` only when
                    // it converted a draft id to a real backend id (deferred
                    // propose bootstrap). For normal cosigns the falls back
                    // to the source's signRequestId.
                    signRequestId:
                        response.resolvedSignRequestId ?? source.signRequestId,
                    status: response.status,
                }
            } catch (error) {
                const err = toError(error)
                throw new TransportError(err.message, err)
            }
        },
    }
}
