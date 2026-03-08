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

import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'
import type {
    DataTransport,
    SigningResult,
    SourceMetadata,
    TransportResult,
} from '../types'
import { TransportError } from '../errors'

/**
 * Encoder function type for signed transactions
 */
export type EncodeSignedTransactionsFn = (
    txns: PeraSignedTransaction[],
) => Uint8Array[]

/**
 * Algod client interface for submitting raw transactions
 */
export interface AlgodClientInterface {
    sendRawTransaction(rawTxns: Uint8Array): Promise<unknown>
}

/**
 * AlgorandClient-like interface with algod client access
 */
export interface AlgokitClientInterface {
    client: {
        algod: AlgodClientInterface
    }
}

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
                // Encode signed transactions
                const encodedTxns = encodeSignedTransactions(signed)

                // Concatenate encoded transactions for raw submission
                const totalLength = encodedTxns.reduce(
                    (sum, arr) => sum + arr.length,
                    0,
                )
                const concatenated = new Uint8Array(totalLength)
                let offset = 0
                for (const arr of encodedTxns) {
                    concatenated.set(arr, offset)
                    offset += arr.length
                }

                // Submit to algod
                const response = (await algokit.client.algod.sendRawTransaction(
                    concatenated,
                )) as { txid?: string | string[] }

                // Extract transaction IDs
                const txIds: string[] = []
                if (typeof response?.txid === 'string') {
                    txIds.push(response.txid)
                } else if (Array.isArray(response?.txid)) {
                    txIds.push(...response.txid)
                }

                // If we didn't get any txIds from response, compute them from the signed txns
                if (txIds.length === 0) {
                    for (const signedTxn of signed) {
                        if (signedTxn.txn.txId) {
                            const id = signedTxn.txn.txId()
                            txIds.push(id)
                        }
                    }
                }

                return {
                    type: 'submitted',
                    txIds,
                }
            } catch (error) {
                throw new TransportError(
                    error instanceof Error ? error.message : String(error),
                    error instanceof Error ? error : undefined,
                )
            }
        },
    }
}
