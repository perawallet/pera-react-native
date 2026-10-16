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
import { logger, toError } from '@perawallet/wallet-core-shared'
import {
    SubmissionError,
    TransportError,
    type DataTransport,
    type SigningResult,
    type SourceMetadata,
    type TransportResult,
} from '@perawallet/wallet-core-signing'
import {
    submitAndAutoRefresh,
    submitSignedAndAutoRefresh,
    type AlgokitClientInterface,
    type EncodeSignedTransactionsFn,
} from '../submission'
import { algorandNetworkOf } from '../../network-id'

/**
 * Creates a transport that submits transactions directly to algod.
 *
 * @param algokit - AlgorandClient instance for network access
 * @param encodeSignedTransactions - Function to encode signed transactions
 * @param capturedScope - Re-checked with `assertScopeUnchanged` before
 *   submitting.
 */
export const createAlgodTransport = (
    algokit: AlgokitClientInterface,
    encodeSignedTransactions: EncodeSignedTransactionsFn,
    capturedScope: ChainScope,
): DataTransport => {
    return {
        send: async (
            result: SigningResult,
            source: SourceMetadata,
            _multisigAddress?: string,
        ): Promise<TransportResult> => {
            const { signedData } = result
            if (
                signedData.type !== 'transactions' &&
                signedData.type !== 'signed-transactions'
            ) {
                throw new TransportError(
                    'Algod transport only supports transaction data',
                )
            }

            assertScopeUnchanged(capturedScope)

            const network = algorandNetworkOf(capturedScope)
            let txIds: string[]
            try {
                txIds =
                    signedData.type === 'transactions'
                        ? await submitAndAutoRefresh(
                              network,
                              algokit,
                              encodeSignedTransactions,
                              signedData.signed,
                              { flow: 'pipeline' },
                          )
                        : await submitSignedAndAutoRefresh(
                              network,
                              algokit,
                              signedData.signed,
                              { flow: 'pipeline' },
                          )
            } catch (error) {
                // A classified submit failure keeps its txIds, classification
                // and retryability — wrapping it in TransportError would
                // collapse "node rejected" and "outcome unknown" back into
                // one retryable-looking failure.
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
                    await source.callbacks.approve(result, { txIds })
                    return { type: 'submitted-and-answered', txIds }
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
