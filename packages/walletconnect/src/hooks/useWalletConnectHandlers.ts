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
import { AlgorandChainId, WalletConnectSession } from '../models'
import { MAX_DATA_SIGN_REQUESTS } from '../constants'
import {
    isLedgerAccount,
    useAllAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

const validateRequest = (
    connector: WalletConnect,
    sessions: WalletConnectSession[],
    network: Network,
    error: Error | null,
): WalletConnectSession => {
    if (error) {
        logger.error(error)
        throw new WalletConnectSignRequestError(error)
    }

    const foundSession = sessions.find(
        session =>
            session.clientId === connector.clientId ||
            session.session?.clientId === connector.clientId,
    )

    if (!foundSession || !foundSession.session) {
        throw new WalletConnectInvalidSessionError(
            new Error('No session found'),
        )
    }

    const { chainId } = foundSession.session

    if (
        chainId !== 4160 &&
        ((network === Networks.mainnet && chainId !== 416001) ||
            (network === Networks.testnet && chainId !== 416002))
    ) {
        throw new WalletConnectInvalidNetworkError()
    }

    return foundSession
}

//TODO implement better error handling mechanism
const validateDataSignRequest = (
    connector: WalletConnect,
    accounts: WalletAccount[],
    sessions: WalletConnectSession[],
    network: Network,
    data: PeraArbitraryDataMessage[],
    error: Error | null,
) => {
    const foundSession = validateRequest(connector, sessions, network, error)

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
    })
}

const useWalletConnectHandlers = () => {
    const sessions = useWalletConnectStore(state => state.walletConnectSessions)
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
                sessions,
                network,
                params,
                error,
            )

            addSignRequest({
                type: 'arbitrary-data',
                transport: 'callback',
                transportId: connector.clientId,
                sourceMetadata: connector.session?.peerMeta,
                data: params,
                approve: async (signedData: PeraArbitraryDataSignResult[]) => {
                    try {
                        logger.debug('signedData', { signedData })
                        if (signedData) {
                            const result = signedData.map(item =>
                                Buffer.from(item.signature).toString('base64'),
                            )
                            const toSend = {
                                id: payload.id,
                                result,
                            }
                            logger.debug('toSend', {
                                toSend: JSON.stringify(toSend),
                            })
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
        [sessions, addSignRequest, network],
    )

    const handleSignTransaction = useCallback(
        (
            connector: WalletConnect,
            error: Error | null,
            //TODO type this correctly
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: any | null,
        ) => {
            validateRequest(connector, sessions, network, error)

            //TODO more validation

            const { txn } = payload.params.at(0)

            addSignRequest({
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
        [sessions, addSignRequest, network],
    )

    return {
        handleSignData,
        handleSignTransaction,
    }
}

export default useWalletConnectHandlers
