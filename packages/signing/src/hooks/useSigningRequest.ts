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

import { useCallback } from 'react'
import {
    PeraSignedTransaction,
    useAlgorandClient,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useTransactionSigner } from './useTransactionSigner'
import { useArbitraryDataSigner } from './useArbitraryDataSigner'
import { useSigningStore } from '../store'
import type {
    SignRequest,
    TransactionSignRequest,
    ArbitraryDataSignRequest,
    PeraArbitraryDataSignResult,
} from '../models'
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'
import {
    MAX_DATA_SIGN_REQUESTS,
    MAX_TRANSACTION_SIGN_REQUESTS,
} from '../constants'

export type SignResult =
    | {
          type: 'transactions'
          signedTransactions: PeraSignedTransaction[]
      }
    | {
          type: 'arbitrary-data'
          signatures: PeraArbitraryDataSignResult[]
      }

const isTransactionRequest = (
    request: SignRequest,
): request is TransactionSignRequest => request.type === 'transactions'

const isArbitraryDataRequest = (
    request: SignRequest,
): request is ArbitraryDataSignRequest => request.type === 'arbitrary-data'

export const useSigningRequest = () => {
    const pendingSignRequests = useSigningStore(
        state => state.pendingSignRequests,
    )
    const lastCompletedRequest = useSigningStore(
        state => state.lastCompletedRequest,
    )
    const addSignRequestToStore = useSigningStore(state => state.addSignRequest)
    const removeSignRequestFromStore = useSigningStore(
        state => state.removeSignRequest,
    )
    const setLastCompletedRequestInStore = useSigningStore(
        state => state.setLastCompletedRequest,
    )

    const { signTransactions } = useTransactionSigner()
    const { encodeSignedTransactions } = useTransactionEncoder()
    const algokit = useAlgorandClient()
    const { signArbitraryData } = useArbitraryDataSigner()
    const allAccounts = useAllAccounts()

    const addSignRequest = useCallback(
        (request: SignRequest) => {
            if (
                request.type === 'transactions' &&
                'txs' in request &&
                request.txs.flat().length > MAX_TRANSACTION_SIGN_REQUESTS
            ) {
                throw new AppError('Maximum number of transactions exceeded.', {
                    severity: ErrorSeverity.MEDIUM,
                    category: ErrorCategory.VALIDATION,
                    recoverable: false,
                    params: {
                        count: request.txs.length,
                        max: MAX_TRANSACTION_SIGN_REQUESTS,
                    },
                })
            }

            if (
                request.type === 'arbitrary-data' &&
                'data' in request &&
                request.data.length > MAX_DATA_SIGN_REQUESTS
            ) {
                throw new AppError('Maximum number of data exceeded.', {
                    severity: ErrorSeverity.MEDIUM,
                    category: ErrorCategory.VALIDATION,
                    recoverable: false,
                    params: {
                        count: request.data.length,
                        max: MAX_DATA_SIGN_REQUESTS,
                    },
                })
            }
            addSignRequestToStore(request)
        },
        [addSignRequestToStore],
    )

    const removeSignRequest = useCallback(
        (request: SignRequest) => {
            removeSignRequestFromStore(request)
        },
        [removeSignRequestFromStore],
    )

    const clearLastCompletedRequest = useCallback(() => {
        setLastCompletedRequestInStore(null)
    }, [setLastCompletedRequestInStore])

    const signTransactionRequest = useCallback(
        async (
            request: TransactionSignRequest,
        ): Promise<PeraSignedTransaction[]> => {
            return signTransactions(
                request.txs,
                request.txs.map((_, idx) => idx),
            )
        },
        [signTransactions],
    )

    const signArbitraryDataRequest = useCallback(
        async (
            request: ArbitraryDataSignRequest,
        ): Promise<PeraArbitraryDataSignResult[]> => {
            const signedData = request.data.map(async data => {
                const account = allAccounts.find(a => a.address === data.signer)
                if (!account) {
                    throw new Error(
                        `Account not found for signer: ${data.signer}`,
                    )
                }
                const signature = await signArbitraryData(account, data.data)
                if (!signature?.length) {
                    throw new Error(
                        `Failed to generate signature for signer: ${data.signer}`,
                    )
                }
                return {
                    signer: account.address,
                    signature: signature[0],
                }
            })
            return Promise.all(signedData)
        },
        [signArbitraryData, allAccounts],
    )

    const signRequest = useCallback(
        async (request: SignRequest): Promise<SignResult> => {
            if (isTransactionRequest(request)) {
                return {
                    type: 'transactions',
                    signedTransactions: await signTransactionRequest(request),
                }
            }
            if (isArbitraryDataRequest(request)) {
                return {
                    type: 'arbitrary-data',
                    signatures: await signArbitraryDataRequest(request),
                }
            }
            throw new Error(`Unsupported sign request type: ${request.type}`)
        },
        [signTransactionRequest, signArbitraryDataRequest],
    )

    const signAndSendRequest = useCallback(
        async (request: SignRequest) => {
            if (isTransactionRequest(request)) {
                const signedTxs = await signTransactionRequest(request)
                if (request.transport === 'algod') {
                    const encodedSignedTransactions =
                        encodeSignedTransactions(signedTxs)
                    algokit.client.algod.sendRawTransaction(
                        encodedSignedTransactions,
                    )
                } else {
                    await request.approve?.(signedTxs)
                }
            } else if (isArbitraryDataRequest(request)) {
                if (request.transport === 'algod') {
                    removeSignRequest(request)
                    throw new Error(
                        'Arbitrary data signing is not supported via algod transport',
                    )
                }
                const signatures = await signArbitraryDataRequest(request)
                await request.approve?.(signatures)
            } else {
                throw new Error(
                    `Unsupported sign request type: ${request.type}`,
                )
            }
            setLastCompletedRequestInStore(request)
            removeSignRequest(request)
        },
        [
            signTransactionRequest,
            signArbitraryDataRequest,
            algokit,
            encodeSignedTransactions,
            removeSignRequest,
            setLastCompletedRequestInStore,
        ],
    )

    const rejectRequest = useCallback(
        (request: SignRequest) => {
            if (request.transport === 'callback') {
                request.reject?.()
            }
            removeSignRequest(request)
        },
        [removeSignRequest],
    )

    return {
        pendingSignRequests,
        lastCompletedRequest,
        currentRequest: pendingSignRequests?.at(0),
        addSignRequest,
        removeSignRequest,
        clearLastCompletedRequest,
        signRequest,
        signAndSendRequest,
        rejectRequest,
    }
}
