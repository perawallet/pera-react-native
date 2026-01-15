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

import { logger, Network, Networks } from '@perawallet/wallet-core-shared'
import {
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSignRequestError,
} from '../errors'
import { useWalletConnectStore } from '../store'
import {
    ArbitraryDataSignRequest,
    PeraArbitraryDataMessage,
    PeraArbitraryDataSignResult,
    PeraSignedTransaction,
    TransactionSignRequest,
    useSigningRequest,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import WalletConnect from '@walletconnect/client'
import { useCallback } from 'react'
import { AlgorandChainId, WalletConnectConnection } from '../models'
import { MAX_DATA_SIGN_REQUESTS } from '../constants'
import {
    isLedgerAccount,
    useAllAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { v7 as uuid } from 'uuid'

const validateRequest = (
    connector: WalletConnect,
    connections: WalletConnectConnection[],
    network: Network,
    error: Error | null,
): WalletConnectConnection => {
    if (error) {
        logger.error(error)
        throw new WalletConnectSignRequestError(error)
    }

    const foundConnection = connections.find(
        conn => conn.clientId === connector.clientId,
    )

    if (!foundConnection || !foundConnection.session) {
        logger.debug('No session found', {
            clientId: connector.clientId,
            connections,
        })

        throw new WalletConnectInvalidSessionError(
            new Error('No session found'),
        )
    }

    const { chainId } = foundConnection.session

    if (
        chainId !== 4160 &&
        ((network === Networks.mainnet && chainId !== 416001) ||
            (network === Networks.testnet && chainId !== 416002))
    ) {
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
        throw new WalletConnectSignRequestError(new Error('No data found'))
    }

    if (!Array.isArray(data) || data.length === 0) {
        throw new WalletConnectSignRequestError(new Error('Invalid data found'))
    }

    if (data.length > MAX_DATA_SIGN_REQUESTS) {
        throw new WalletConnectSignRequestError(
            new Error('Too many sign requests found'),
        )
    }

    data.forEach(item => {
        if (
            item.chainId !== AlgorandChainId.all &&
            item.chainId !== AlgorandChainId[network]
        ) {
            throw new WalletConnectInvalidNetworkError(
                new Error("ChainId doesn't match"),
            )
        }

        if (!foundSession.session?.accounts.includes(item.signer)) {
            throw new WalletConnectInvalidSessionError(
                new Error('Invalid signer'),
            )
        }

        const account = accounts.find(
            account => account.address === item.signer,
        )
        if (!account) {
            throw new WalletConnectInvalidSessionError(
                new Error('Invalid signer'),
            )
        }

        if (isLedgerAccount(account)) {
            throw new WalletConnectInvalidSessionError(
                new Error('Ledger accounts are not supported'),
            )
        }

        if (!item.data) {
            throw new WalletConnectSignRequestError(
                new Error('Data is missing'),
            )
        }
    })
}

export const useWalletConnectHandlers = () => {
    const connections = useWalletConnectStore(
        state => state.walletConnectConnections,
    )
    const { addSignRequest } = useSigningRequest()
    const { encodeSignedTransaction } = useTransactionEncoder()
    const { network } = useNetwork()
    const accounts = useAllAccounts()

    //TODO handle ARC-60 sign requests
    const handleSignData = useCallback(
        (
            connector: WalletConnect,
            error: Error | null,
            //TODO type this correctly
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: any | null,
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
                id: uuid(),
                type: 'arbitrary-data',
                transport: 'callback',
                transportId: connector.clientId,
                sourceMetadata: connector.session?.peerMeta,
                data: params,
                approve: async (signedData: PeraArbitraryDataSignResult[]) => {
                    try {
                        if (signedData) {
                            const result = signedData.map(item =>
                                Buffer.from(item.signature).toString('base64'),
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
                error: async (error: string) => {
                    throw new WalletConnectSignRequestError(new Error(error))
                },
            } as ArbitraryDataSignRequest)
        },
        [connections, addSignRequest, network],
    )

    const handleSignTransaction = useCallback(
        (
            connector: WalletConnect,
            error: Error | null,
            //TODO type this correctly
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: any | null,
        ) => {
            validateRequest(connector, connections, network, error)

            //TODO more validation

            const { txn } = payload.params.at(0)

            addSignRequest({
                id: uuid(),
                type: 'transactions',
                transport: 'callback',
                transportId: connector.clientId,
                txs: [txn],
                approve: async (signed: (PeraSignedTransaction | null)[][]) => {
                    const signedTxns = signed.map(txns =>
                        txns.map(txn =>
                            txn ? encodeSignedTransaction(txn) : null,
                        ),
                    )

                    if (signedTxns) {
                        connector.approveRequest({
                            id: payload.id,
                            result: signedTxns,
                        })
                    }
                },
                reject: async () => {
                    connector.rejectRequest({
                        id: payload.id,
                        error: new Error('User rejected'),
                    })
                },
                error: async (error: string) => {
                    throw new WalletConnectSignRequestError(new Error(error))
                },
            } as TransactionSignRequest)
        },
        [connections, addSignRequest, network],
    )

    return {
        handleSignData,
        handleSignTransaction,
    }
}
