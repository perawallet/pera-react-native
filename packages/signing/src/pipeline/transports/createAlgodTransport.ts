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

import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { logger, toError, type Network } from '@perawallet/wallet-core-shared'
import type {
    DataTransport,
    SigningResult,
    SourceMetadata,
    TransportResult,
} from '../types'
import { NetworkChangedError, SubmissionError, TransportError } from '../errors'
import {
    submitAndAutoRefresh,
    type AlgokitClientInterface,
    type EncodeSignedTransactionsFn,
} from '../submission'

// Re-export for backward compatibility with callers that import these
// types from `createAlgodTransport`. The source of truth lives in
// `../submission/types`.
export type {
    AlgokitClientInterface,
    EncodeSignedTransactionsFn,
} from '../submission'

/**
 * Creates a transport that submits transactions directly to algod.
 *
 * @param algokit - AlgorandClient instance for network access
 * @param encodeSignedTransactions - Function to encode signed transactions
 * @param capturedNetwork - The network that was active when the signing actor
 *   was created. Re-compared against the live network at submit time — if the
 *   user switched networks mid-flow the transaction is aborted rather than
 *   submitted to the wrong chain.
 */
export const createAlgodTransport = (
    algokit: AlgokitClientInterface,
    encodeSignedTransactions: EncodeSignedTransactionsFn,
    capturedNetwork: Network,
): DataTransport => {
    return {
        send: async (
            result: SigningResult,
            source: SourceMetadata,
            _multisigAddress?: string,
        ): Promise<TransportResult> => {
            // Only handle transaction data
            if (result.signedData.type !== 'transactions') {
                throw new TransportError(
                    'Algod transport only supports transaction data',
                )
            }

            const liveNetwork = useNetworkStore.getState().network
            if (liveNetwork !== capturedNetwork) {
                throw new NetworkChangedError(capturedNetwork, liveNetwork)
            }

            const { signed } = result.signedData

            let txIds: string[]
            try {
                txIds = await submitAndAutoRefresh(
                    algokit,
                    encodeSignedTransactions,
                    signed,
                )
            } catch (error) {
                // A classified submit failure keeps its txIds, classification
                // and retryability — wrapping it in TransportError would
                // collapse "node rejected" and "outcome unknown" back into
                // one retryable-looking failure (PERA-4587 / PERA-4896).
                if (error instanceof SubmissionError) {
                    throw error
                }
                const err = toError(error)
                throw new TransportError(err.message, err)
            }

            // Notify the originator after a successful submission. Sources
            // like gift-card route here (algod submits the payment) but
            // still carry an approve callback that relays the outcome to
            // an external surface (e.g. the Bidali webview's paymentSent).
            // The submission already went through, so a failing callback
            // must not fail the pipeline — log and return success.
            if (source.callbacks?.approve) {
                try {
                    await source.callbacks.approve(result)
                } catch (error) {
                    logger.error(
                        'Algod transport: approve callback failed after submission',
                        { error },
                    )
                }
            }

            return {
                type: 'submitted',
                txIds,
            }
        },
    }
}
