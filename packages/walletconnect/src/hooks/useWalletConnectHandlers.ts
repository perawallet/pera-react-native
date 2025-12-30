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
    Transaction,
    TransactionSignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-blockchain'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import WalletConnect from '@walletconnect/client'
import { useCallback } from 'react'
import { WalletConnectSession } from '../models'

const validateRequest = (
    connector: WalletConnect,
    sessions: WalletConnectSession[],
    network: Network,
    error: Error | null,
) => {
    if (error) {
        logger.error(error)
        throw new WalletConnectSignRequestError(error)
    }

    const existingSession = sessions.find(
        session => session.clientId === connector.clientId,
    )
    if (!existingSession || !existingSession.session) {
        logger.error('WC algo_signData received, but no session found')
        throw new WalletConnectInvalidSessionError(
            new Error('No session found'),
        )
    }

    const { chainId } = existingSession.session

    if (
        chainId !== 4160 &&
        ((network === Networks.mainnet && chainId !== 416001) ||
            (network === Networks.testnet && chainId !== 416002))
    ) {
        logger.error("WC algo_signData received, but chainId doesn't match")
        throw new WalletConnectInvalidNetworkError()
    }
}

const useWalletConnectHandlers = () => {
    const sessions = useWalletConnectStore(state => state.walletConnectSessions)
    const { addSignRequest } = useSigningRequest()
    const { network } = useNetwork()

    const handleSignData = useCallback(
        (
            connector: WalletConnect,
            error: Error | null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: any | null,
        ) => {
            logger.debug('WC algo_signData received', { error, payload })
            validateRequest(connector, sessions, network, error)

            const param = payload?.params?.at(0)

            if (!param) {
                logger.error('WC algo_signData received, but no data found')
                throw new WalletConnectSignRequestError(
                    new Error('No data found'),
                )
            }

            const { message, data } = param

            if (!data) {
                logger.error('WC algo_signData received, but no data found')
                throw new WalletConnectSignRequestError(
                    new Error('No data found'),
                )
            }

            addSignRequest({
                type: 'arbitrary-data',
                transport: 'callback',
                transportId: connector.clientId,
                message,
                addresses: connector.accounts,
                data,
                success: async (
                    signingAddress: string,
                    signature: Uint8Array,
                ) => {
                    if (signature) {
                        await connector.sendTransaction({
                            from: signingAddress,
                            data: Buffer.from(signature).toString('base64'),
                        })
                    }
                },
                error: async (_, error: string) => {
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: any | null,
        ) => {
            logger.debug('WC algo_signTxn received', { error, payload })
            validateRequest(connector, sessions, network, error)

            const existingSession = sessions.find(
                session => session.clientId === connector.clientId,
            )
            if (!existingSession) {
                logger.error('WC algo_signTxn received, but no session found')
                return
            }
            const { message, txn } = payload.params.at(0)
            addSignRequest({
                type: 'transactions',
                transport: 'callback',
                transportId: connector.clientId,
                message,
                addresses: connector.accounts,
                txs: [txn],
                success: async (
                    signingAddress: string,
                    signed: (Transaction | null)[][],
                ) => {
                    //TODO we probably need to use algokit here to pack this up correctly
                    const signedTxn = JSON.stringify(signed.at(0)?.at(0))

                    if (signedTxn) {
                        connector.sendTransaction({
                            from: signingAddress,
                            data: Buffer.from(signedTxn).toString('base64'),
                        })
                    }
                },
                error: async (_, error: string) => {
                    throw new WalletConnectSignRequestError(new Error(error))
                },
            } as TransactionSignRequest)
        },
        [sessions, addSignRequest],
    )

    return {
        handleSignData,
        handleSignTransaction,
    }
}

export default useWalletConnectHandlers
