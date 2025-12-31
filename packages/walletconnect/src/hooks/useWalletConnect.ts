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

import { ALL_PERMISSIONS, PERA_CLIENT_META } from '../constants'
import { WalletConnectInvalidSessionError } from '../errors'
import { WalletConnectSession, WalletConnectSessionRequest } from '../models'
import { useWalletConnectStore } from '../store'
import WalletConnect from '@walletconnect/client'
import { useCallback } from 'react'
import { useWalletConnectSessionRequests } from './useWalletConnectSessionRequests'
import useWalletConnectHandlers from './useWalletConnectHandlers'
import { logger } from '@perawallet/wallet-core-shared'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'

const connectors = new Map<string, WalletConnect>()

export const useWalletConnect = () => {
    const sessions = useWalletConnectStore(state => state.walletConnectSessions)
    const setSessions = useWalletConnectStore(
        state => state.setWalletConnectSessions,
    )
    const { addSessionRequest } = useWalletConnectSessionRequests()
    const { handleSignData, handleSignTransaction } = useWalletConnectHandlers()
    const accounts = useAllAccounts()

    const connectSession = useCallback(
        async ({ session }: { session: WalletConnectSession }) => {
            const connector = new WalletConnect({
                ...session,
                clientMeta: PERA_CLIENT_META,
            })

            connector.on('algo_signData', (error, payload) =>
                handleSignData(connector, error, payload),
            )
            connector.on('algo_signTxn', (error, payload) =>
                handleSignTransaction(connector, error, payload),
            )

            connector.on('disconnect', () => {
                logger.debug('WC disconnect received')
                disconnectSession(connector.clientId, false)
            })
            connector.on('session_request', (error, payload) => {
                if (error) {
                    logger.error(error)
                    return
                }
                const { peerMeta, chainId, permissions } = payload.params[0]

                logger.debug('WC session_request received', { payload })
                if (session.autoConnect) {
                    approveSession(
                        connector.clientId,
                        payload.params[0],
                        accounts.map(a => a.address),
                    )
                } else {
                    addSessionRequest({
                        peerMeta,
                        chainId,
                        permissions: permissions ?? ALL_PERMISSIONS,
                        clientId: connector.clientId,
                    })
                }
            })

            if (!connector.connected) {
                logger.debug(
                    'WC connectSession connector not connected, connecting...',
                )
            }

            connector.on('error', error => {
                logger.error('WC error received', { error })
            })

            connectors.set(connector.clientId, connector)
        },
        [addSessionRequest],
    )

    const reconnectAllSessions = useCallback(() => {
        sessions.forEach(session => {
            connectSession({ session })
        })
        setSessions(
            sessions.map(session => {
                if (!session.clientId) {
                    return {
                        ...session,
                        connected: false,
                    }
                }
                const connector = connectors.get(session.clientId)
                return {
                    ...session,
                    connected: connector?.connected ?? false,
                }
            }),
        )
    }, [connectSession, sessions])

    const disconnectSession = useCallback(
        async (clientId: string, triggerDisconnect: boolean) => {
            const connector = connectors.get(clientId)
            if (connector && connector.connected && triggerDisconnect) {
                logger.debug(
                    'WC disconnectSession connector found, disconnecting...',
                )
                await connector.killSession({
                    message: 'User disconnected',
                })
            }
            connectors.delete(clientId)
            setSessions(
                sessions.filter(
                    session => session.session?.clientId !== clientId,
                ),
            )
        },
        [sessions],
    )

    const approveSession = useCallback(
        (
            clientId: string,
            request: WalletConnectSessionRequest,
            addresses: string[],
        ) => {
            const existingSession = sessions.find(
                session => session.session?.clientId === clientId,
            )

            const connector = connectors.get(clientId)
            if (!connector) {
                throw new WalletConnectInvalidSessionError()
            }

            connector.approveSession({
                chainId: request.chainId,
                accounts: addresses,
            })

            setSessions([
                ...sessions.filter(
                    session => session.session?.clientId !== clientId,
                ),
                {
                    ...existingSession,
                    ...connector,
                    clientId,
                    createdAt: new Date(),
                    lastActiveAt: new Date(),
                    session: {
                        permissions: request.permissions,
                        ...connector.session,
                    },
                },
            ])
        },
        [sessions],
    )

    const rejectSession = useCallback(
        (clientId: string) => {
            const connector = connectors.get(clientId)
            if (!connector) {
                throw new WalletConnectInvalidSessionError()
            }

            connector.rejectSession()

            setSessions(
                sessions.filter(
                    session => session.session?.clientId !== clientId,
                ),
            )
        },
        [sessions],
    )

    const deleteAllSessions = useCallback(async () => {
        const promises = sessions.map(session => {
            if (session.clientId) {
                return disconnectSession(session.clientId, true)
            }
            return Promise.resolve()
        })
        await Promise.all(promises)
        setSessions([])
    }, [sessions])

    return {
        sessions,
        reconnectAllSessions,
        connectSession,
        disconnectSession,
        approveSession,
        rejectSession,
        deleteAllSessions,
    }
}
