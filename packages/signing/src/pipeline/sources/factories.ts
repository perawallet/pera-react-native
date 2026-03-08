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
    DataSource,
    SignableData,
    SignableGroup,
    SourceMetadata,
} from '../types'
import { SourceError } from '../errors'

/**
 * Create a source for locally-constructed data.
 * The builder function constructs the signable data from params.
 *
 * @example
 * const paymentSource = createLocalSource(async (params) => ({
 *   type: 'transactions',
 *   transactions: [paymentTxn],
 *   rawTransactionsBase64: [encoded],
 *   indicesToSign: [0],
 * }))
 */
export const createLocalSource = <TParams>(
    builder: (params: TParams) => Promise<SignableData>,
): DataSource<TParams> => ({
    getSignableData: async (params: TParams): Promise<SignableGroup> => {
        try {
            const data = await builder(params)
            return {
                data,
                source: { type: 'local' },
            }
        } catch (error) {
            throw new SourceError(
                error instanceof Error ? error.message : String(error),
                error instanceof Error ? error : undefined,
            )
        }
    },
})

/**
 * Create a source for externally-received data (WalletConnect, etc.).
 * The decoder extracts signable data from the external request.
 *
 * @example
 * const walletConnectSource = createExternalSource(async (request) => ({
 *   data: {
 *     type: 'transactions',
 *     transactions: decodedTxns,
 *     rawTransactionsBase64: request.params.txns,
 *     indicesToSign: [0, 1, 2],
 *   },
 *   metadata: {
 *     peerMetadata: request.peerMeta,
 *     requestId: request.id,
 *   },
 * }))
 */
export const createExternalSource = <TRequest>(
    decoder: (
        request: TRequest,
    ) => Promise<{ data: SignableData; metadata: Partial<SourceMetadata> }>,
): DataSource<TRequest> => ({
    getSignableData: async (request: TRequest): Promise<SignableGroup> => {
        try {
            const { data, metadata } = await decoder(request)
            return {
                data,
                source: { type: 'walletconnect', ...metadata },
            }
        } catch (error) {
            throw new SourceError(
                error instanceof Error ? error.message : String(error),
                error instanceof Error ? error : undefined,
            )
        }
    },
})

/**
 * Create a source that fetches data from backend (multisig co-sign).
 *
 * @example
 * const cosignSource = createFetchSource(async ({ signRequestId }) => {
 *   const request = await fetchSignRequest(signRequestId)
 *   return {
 *     data: {
 *       type: 'transactions',
 *       transactions: decodedTxns,
 *       rawTransactionsBase64: request.transactions,
 *       indicesToSign: request.indicesToSign,
 *     },
 *     signRequestId,
 *   }
 * })
 */
export const createFetchSource = <TParams>(
    fetcher: (
        params: TParams,
    ) => Promise<{ data: SignableData; signRequestId: string }>,
): DataSource<TParams> => ({
    getSignableData: async (params: TParams): Promise<SignableGroup> => {
        try {
            const { data, signRequestId } = await fetcher(params)
            return {
                data,
                source: { type: 'multisig-cosign', signRequestId },
            }
        } catch (error) {
            throw new SourceError(
                error instanceof Error ? error.message : String(error),
                error instanceof Error ? error : undefined,
            )
        }
    },
})
