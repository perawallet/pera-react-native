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

import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import type {
    DataSource,
    TransactionSignableData,
    ArbitraryDataSignableData,
    SourceMetadata,
    SigningResult,
} from '../types'
import { createExternalSource } from './factories'

/**
 * WalletConnect transaction request payload
 */
export interface WalletConnectTransactionRequest {
    /** Request ID from WalletConnect */
    requestId: number

    /** Client ID of the WalletConnect connector */
    clientId: string

    /** Decoded transactions */
    transactions: PeraTransaction[]

    /** Raw transaction bytes (base64 encoded) */
    rawTransactionsBase64: string[]

    /** Indices of transactions that need signing */
    indicesToSign: number[]

    /** Peer metadata (dApp info) */
    peerMetadata?: {
        name?: string
        description?: string
        url?: string
        icons?: string[]
    }

    /** Callback to approve the request */
    approve: (result: SigningResult) => Promise<void>

    /** Callback to reject the request */
    reject: () => Promise<void>

    /** Callback to report an error */
    error?: (error: string) => Promise<void>
}

/**
 * WalletConnect arbitrary data (message signing) request
 */
export interface WalletConnectDataRequest {
    /** Request ID from WalletConnect */
    requestId: number

    /** Client ID of the WalletConnect connector */
    clientId: string

    /** Data items to sign */
    data: Array<{
        signer: string
        data: string
        message?: string
        chainId: number
    }>

    /** Peer metadata (dApp info) */
    peerMetadata?: {
        name?: string
        description?: string
        url?: string
        icons?: string[]
    }

    /** Callback to approve the request */
    approve: (signatures: unknown) => Promise<void>

    /** Callback to reject the request */
    reject: () => Promise<void>

    /** Callback to report an error */
    error?: (error: string) => Promise<void>
}

/**
 * Union of WalletConnect request types
 */
export type WalletConnectRequest =
    | ({ type: 'transactions' } & WalletConnectTransactionRequest)
    | ({ type: 'arbitrary-data' } & WalletConnectDataRequest)

/**
 * Create a source for WalletConnect transaction requests.
 *
 * @example
 * const source = createWalletConnectTransactionSource()
 * const group = await source.getSignableData(walletConnectRequest)
 */
export const createWalletConnectTransactionSource =
    (): DataSource<WalletConnectTransactionRequest> => {
        return createExternalSource<WalletConnectTransactionRequest>(
            async request => {
                const signableData: TransactionSignableData = {
                    type: 'transactions',
                    transactions: request.transactions,
                    rawTransactionsBase64: request.rawTransactionsBase64,
                    indicesToSign: request.indicesToSign,
                }

                const metadata: Partial<SourceMetadata> = {
                    type: 'walletconnect',
                    peerMetadata: request.peerMetadata,
                    requestId: String(request.requestId),
                    callbacks: {
                        approve: request.approve,
                        reject: request.reject,
                        error: request.error,
                    },
                }

                const signerAddress =
                    request.transactions[0]?.sender.toString() ?? ''

                return { data: signableData, signerAddress, metadata }
            },
        )
    }

/**
 * Create a source for WalletConnect arbitrary data signing requests.
 *
 * @example
 * const source = createWalletConnectDataSource()
 * const group = await source.getSignableData(walletConnectDataRequest)
 */
export const createWalletConnectDataSource =
    (): DataSource<WalletConnectDataRequest> => {
        return createExternalSource<WalletConnectDataRequest>(async request => {
            const signableData: ArbitraryDataSignableData = {
                type: 'arbitrary-data',
                data: request.data.map(item => ({
                    signer: item.signer,
                    data: item.data,
                    message: item.message,
                    chainId: item.chainId,
                })),
            }

            const metadata: Partial<SourceMetadata> = {
                type: 'walletconnect',
                peerMetadata: request.peerMetadata,
                requestId: String(request.requestId),
                callbacks: {
                    approve: request.approve,
                    reject: request.reject,
                    error: request.error,
                },
            }

            const signerAddress = request.data[0]?.signer ?? ''

            return { data: signableData, signerAddress, metadata }
        })
    }
