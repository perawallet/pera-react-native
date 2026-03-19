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

import {
    decodeFromBase64,
    encodeToBase64,
    generateOrderedUniqueId,
    logger,
    Network,
    Networks,
} from '@perawallet/wallet-core-shared'
import {
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSignRequestError,
} from '../errors'
import { useWalletConnectStore } from '../store'
import {
    PeraSignedTransaction,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    type ArbitraryDataSignRequest,
    type PeraArbitraryDataMessage,
    type PeraArbitraryDataSignResult,
    type TransactionSignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import WalletConnect from '@walletconnect/client'
import { useCallback } from 'react'
import {
    AlgorandChainId,
    WalletConnectConnection,
    WalletConnectTransactionPayload,
} from '../models'
import { MAX_DATA_SIGN_REQUESTS } from '../constants'
import {
    isLedgerAccount,
    useAllAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

const validateRequest = (
    connector: WalletConnect,
    connections: WalletConnectConnection[],
    network: Network,
    error: Error | null,
): WalletConnectConnection => {
    if (error) {
        logger.error(error)
        throw new WalletConnectSignRequestError(
            'An error occurred while handling a wallet connect request.',
            error,
        )
    }

    const foundConnection = connections.find(
        conn => conn.clientId === connector.clientId,
    )

    if (!foundConnection || !foundConnection.session) {
        logger.debug('No session found', {
            clientId: connector.clientId,
            connections,
        })

        throw new WalletConnectInvalidSessionError('No session found')
    }

    const expectedChainId =
        network === Networks.testnet
            ? AlgorandChainId.testnet
            : AlgorandChainId.mainnet

    const { chainId } = foundConnection.session

    if (chainId !== AlgorandChainId.all && chainId !== expectedChainId) {
        logger.debug('Invalid network', {
            clientId: connector.clientId,
            connections,
        })
        throw new WalletConnectInvalidNetworkError()
    }

    return foundConnection
}

//TODO implement better error handling mechanism or maybe we just need to create a better
// Error boundary in the app?
const validateDataSignRequest = (
    connector: WalletConnect,
    accounts: WalletAccount[],
    connections: WalletConnectConnection[],
    network: Network,
    data: PeraArbitraryDataMessage[],
    error: Error | null,
) => {
    const foundSession = validateRequest(connector, connections, network, error)

    if (!data) {
        throw new WalletConnectSignRequestError('No data found')
    }

    if (!Array.isArray(data) || data.length === 0) {
        throw new WalletConnectSignRequestError('Invalid data found')
    }

    if (data.length > MAX_DATA_SIGN_REQUESTS) {
        throw new WalletConnectSignRequestError('Too many sign requests found')
    }

    const expectedChainId =
        network === Networks.testnet
            ? AlgorandChainId.testnet
            : AlgorandChainId.mainnet

    data.forEach(item => {
        if (
            item.chainId !== AlgorandChainId.all &&
            item.chainId !== expectedChainId
        ) {
            throw new WalletConnectInvalidNetworkError("ChainId doesn't match")
        }

        if (!foundSession.session?.accounts.includes(item.signer)) {
            throw new WalletConnectInvalidSessionError('Invalid signer')
        }

        const account = accounts.find(
            account => account.address === item.signer,
        )
        if (!account) {
            throw new WalletConnectInvalidSessionError('Invalid signer')
        }

        if (isLedgerAccount(account)) {
            throw new WalletConnectInvalidSessionError(
                'Ledger accounts are not supported',
            )
        }

        if (!item.data) {
            throw new WalletConnectSignRequestError('Data is missing')
        }
    })
}

export const useWalletConnectHandlers = () => {
    const connections = useWalletConnectStore(
        state => state.walletConnectConnections,
    )
    const { addSignRequest } = useSigningRequest()
    const { encodeSignedTransactions, decodeTransactions } =
        useTransactionEncoder()
    const accounts = useAllAccounts()

    //TODO handle ARC-60 sign requests
    const handleSignData = useCallback(
        (
            connector: WalletConnect,
            network: Network,
            error: Error | null,
            //TODO type this correctly
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: any | null,
            onError: (error: Error) => void,
        ) => {
            const params = payload?.params
            validateDataSignRequest(
                connector,
                accounts,
                connections,
                network,
                params,
                error,
            )

            addSignRequest({
                id: generateOrderedUniqueId(),
                type: 'arbitrary-data',
                transport: 'callback',
                sourceType: 'walletconnect',
                transportId: connector.clientId,
                sourceMetadata: connector.session?.peerMeta,
                data: params,
                approve: async (signedData: PeraArbitraryDataSignResult[]) => {
                    try {
                        if (signedData) {
                            const result = signedData.map(item =>
                                encodeToBase64(item.signature),
                            )
                            const toSend = {
                                id: payload.id,
                                result,
                            }
                            await connector.approveRequest(toSend)
                        }
                    } catch (error) {
                        connector.rejectRequest({
                            id: payload.id,
                            error: error as Error,
                        })
                    }
                },
                reject: async () => {
                    connector.rejectRequest({
                        id: payload.id,
                        error: new Error('User rejected'),
                    })
                },
                error: async (error: Error) => {
                    onError(new WalletConnectSignRequestError(error.message))
                },
            } as ArbitraryDataSignRequest)
        },
        [connections, addSignRequest],
    )

    const handleSignTransaction = useCallback(
        (
            connector: WalletConnect,
            network: Network,
            error: Error | null,
            payload: WalletConnectTransactionPayload | null,
            onError: (error: Error) => void,
        ) => {
            logger.debug('handleSignTransaction', { payload, network })
            validateRequest(connector, connections, network, error)
            const paramOne = payload?.params?.at(0)
            if (!payload || !paramOne) {
                throw new WalletConnectSignRequestError(
                    'Invalid data found - parameter required',
                )
            }

            // ARC-0001: determine which transactions this wallet should sign
            // signers absent or non-empty → sign; signers: [] → do not sign
            const indicesToSign: number[] = []
            for (let i = 0; i < paramOne.length; i++) {
                const param = paramOne[i]
                if (!param.signers || param.signers.length > 0) {
                    indicesToSign.push(i)
                }
            }

            // If no transactions need signing, approve with all-null array
            if (indicesToSign.length === 0) {
                connector.approveRequest({
                    id: payload.id,
                    result: new Array(paramOne.length).fill(null),
                })
                return
            }

            const signableParams = indicesToSign.map(i => paramOne[i])
            const txnObjects = decodeTransactions(
                signableParams.map(p => decodeFromBase64(p.txn)),
            )

            addSignRequest({
                id: generateOrderedUniqueId(),
                type: 'transactions',
                transport: 'callback',
                sourceType: 'walletconnect',
                transportId: connector.clientId,
                txs: txnObjects,
                sourceMetadata: connector.session?.peerMeta,
                approve: async (signed: (PeraSignedTransaction | null)[]) => {
                    // Reconstruct full-length response with null at skipped positions
                    const result: (string | null)[] = new Array(
                        paramOne.length,
                    ).fill(null)
                    signed.forEach((tx, i) => {
                        if (tx) {
                            const [encoded] = encodeSignedTransactions([tx])
                            result[indicesToSign[i]] = encodeToBase64(encoded)
                        }
                    })

                    connector.approveRequest({
                        id: payload.id,
                        result,
                    })
                },
                reject: async () => {
                    connector.rejectRequest({
                        id: payload.id,
                        error: new Error('User rejected'),
                    })
                },
                error: async (error: Error) => {
                    onError(new WalletConnectSignRequestError(error.message))
                },
            } as TransactionSignRequest)
        },
        [connections, addSignRequest],
    )

    return {
        handleSignData,
        handleSignTransaction,
    }
}
