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

import { toError } from '@perawallet/wallet-core-shared'

import type {
    DataSource,
    SignableData,
    SignableGroup,
    SourceMetadata,
} from '../types'
import { SourceError } from '../errors'

/** The builder returns the signable data plus the address that should sign it. */
export const createLocalSource = <TParams>(
    builder: (
        params: TParams,
    ) => Promise<{ data: SignableData; signerAddress: string }>,
): DataSource<TParams> => ({
    getSignableData: async (params: TParams): Promise<SignableGroup> => {
        try {
            const { data, signerAddress } = await builder(params)
            return {
                data,
                source: { type: 'local' },
                signerAddress,
            }
        } catch (error) {
            const err = toError(error)
            throw new SourceError(err.message, err)
        }
    },
})

/**
 * Create a source for externally-received data (WalletConnect, etc.).
 * The decoder extracts signable data and the signer address from the external request.
 *
 * @example
 * const walletConnectSource = createExternalSource(async (request) => ({
 *   data: {
 *     type: 'transactions',
 *     transactions: decodedTxns,
 *     rawTransactionsBase64: request.params.txns,
 *     indicesToSign: [0, 1, 2],
 *   },
 *   signerAddress: decodedTxns[0].sender.toString(),
 *   metadata: {
 *     peerMetadata: request.peerMeta,
 *     requestId: request.id,
 *   },
 * }))
 */
export const createExternalSource = <TRequest>(
    decoder: (request: TRequest) => Promise<{
        data: SignableData
        signerAddress: string
        // `type` is fixed by the factory and must never come from the decoded
        // (request-controlled) metadata — omitting it here blocks that at the
        // type level; the spread order below is the matching runtime guard.
        metadata: Partial<Omit<SourceMetadata, 'type'>>
    }>,
): DataSource<TRequest> => ({
    getSignableData: async (request: TRequest): Promise<SignableGroup> => {
        try {
            const { data, signerAddress, metadata } = await decoder(request)
            return {
                data,
                // Literal `type` follows the spread so request-controlled
                // metadata can never override it to a non-interactive source
                // and bypass the approval gate.
                source: { ...metadata, type: 'walletconnect' },
                signerAddress,
            }
        } catch (error) {
            const err = toError(error)
            throw new SourceError(err.message, err)
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
 *     signerAddress: request.signerAddress,
 *     signRequestId,
 *   }
 * })
 */
export const createFetchSource = <TParams>(
    fetcher: (params: TParams) => Promise<{
        data: SignableData
        signerAddress: string
        signRequestId: string
    }>,
): DataSource<TParams> => ({
    getSignableData: async (params: TParams): Promise<SignableGroup> => {
        try {
            const { data, signerAddress, signRequestId } = await fetcher(params)
            return {
                data,
                source: { type: 'multisig-cosign', signRequestId },
                signerAddress,
            }
        } catch (error) {
            const err = toError(error)
            throw new SourceError(err.message, err)
        }
    },
})
