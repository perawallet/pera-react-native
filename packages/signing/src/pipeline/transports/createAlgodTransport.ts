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
} from '../types'
import { TransportError } from '../errors'
import {
    submitSignedTransactionGroup,
    type AlgokitClientInterface,
    type EncodeSignedTransactionsFn,
} from '../submission'

// Re-export for backward compatibility with callers that import these
// types from `createAlgodTransport`. The source of truth lives in
// `../submission/types`.
export type {
    AlgodClientInterface,
    AlgokitClientInterface,
    EncodeSignedTransactionsFn,
} from '../submission'

/**
 * Creates a transport that submits transactions directly to algod.
 *
 * @param algokit - AlgorandClient instance for network access
 * @param encodeSignedTransactions - Function to encode signed transactions
 */
export const createAlgodTransport = (
    algokit: AlgokitClientInterface,
    encodeSignedTransactions: EncodeSignedTransactionsFn,
): DataTransport => {
    return {
        send: async (
            result: SigningResult,
            _source: SourceMetadata,
            _jointAccountAddress?: string,
        ): Promise<TransportResult> => {
            // Only handle transaction data
            if (result.signedData.type !== 'transactions') {
                throw new TransportError(
                    'Algod transport only supports transaction data',
                )
            }

            const { signed } = result.signedData

            try {
                const txIds = await submitSignedTransactionGroup(
                    algokit,
                    encodeSignedTransactions,
                    signed,
                )

                return {
                    type: 'submitted',
                    txIds,
                }
            } catch (error) {
                const err =
                    error instanceof Error ? error : new Error(String(error))
                throw new TransportError(err.message, err)
            }
        },
    }
}
