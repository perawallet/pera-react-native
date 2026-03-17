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

import type {
    DataTransport,
    SigningResult,
    SourceMetadata,
    TransportResult,
    SignRequestStatus,
} from '../types'
import { TransportError } from '../errors'

/**
 * Function type for proposing a multisig transaction to the backend
 */
export type ProposeSignRequestFn = (params: {
    jointAccountAddress: string
    signedData: SigningResult['signedData']
    signers: SigningResult['signers']
}) => Promise<{ signRequestId: string; status: SignRequestStatus }>

/**
 * Creates a transport that proposes a new multisig transaction to the backend.
 * This is used when initiating a transaction from a multisig account.
 *
 * @param proposeSignRequest - Function to call the backend API
 */
export const createMultisigProposeTransport = (
    proposeSignRequest: ProposeSignRequestFn,
): DataTransport => {
    return {
        send: async (
            result: SigningResult,
            _source: SourceMetadata,
            jointAccountAddress?: string,
        ): Promise<TransportResult> => {
            if (!jointAccountAddress) {
                throw new TransportError(
                    'Joint account address is required for multisig propose transport',
                )
            }

            try {
                const response = await proposeSignRequest({
                    jointAccountAddress,
                    signedData: result.signedData,
                    signers: result.signers,
                })

                return {
                    type: 'proposed',
                    signRequestId: response.signRequestId,
                    status: response.status,
                }
            } catch (error) {
                const err =
                    error instanceof Error ? error : new Error(String(error))
                throw new TransportError(err.message, err)
            }
        },
    }
}
