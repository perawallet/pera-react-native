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
import { WalletConnectConnection, WalletConnectSessionRequest } from '../models'
import { useWalletConnectStore } from '../store'
import WalletConnect from '@walletconnect/client'
import { createRef, useCallback, useEffect } from 'react'
import { useWalletConnectSessionRequests } from './useWalletConnectSessionRequests'
import { useWalletConnectHandlers } from './useWalletConnectHandlers'
import { logger, Network } from '@perawallet/wallet-core-shared'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'

const connectors = new Map<string, WalletConnect>()

const defaultErrorHandler = (error: Error) => {
    logger.error('An error occurred when handling a wallet connect message', {
        error,
    })
}

const walletConnectRefreshCounter = createRef<number>()

const triggerWCRefresh = () => {
    walletConnectRefreshCounter.current =
        (walletConnectRefreshCounter.current ?? 0) + 1
}

type UseWalletConnectOptions = {
    onError?: (error: Error) => void
}

export const useWalletConnect = (
    network: Network,
    options?: UseWalletConnectOptions,
) => {
    const connections = useWalletConnectStore(
        state => state.walletConnectConnections,
    )
    const setConnections = useWalletConnectStore(
        state => state.setWalletConnectConnections,
    )
    const { addSessionRequest } = useWalletConnectSessionRequests()
    const { handleSignData, handleSignTransaction } = useWalletConnectHandlers()
    const accounts = useAllAccounts()

    const initWalletConnect = useCallback(() => {
        triggerWCRefresh()
    }, [])

    useEffect(() => {
        if (walletConnectRefreshCounter.current) {
            reconnectAllSessions()
        }
    }, [walletConnectRefreshCounter.current])

    const connect = useCallback(
        async ({ connection }: { connection: WalletConnectConnection }) => {
            logger.debug("[WC] Reconnecting", { connection, network })
            const { autoConnect, ...restConnection } = connection

            let connector: WalletConnect | undefined = undefined

            if (connection.clientId) {
                const storedConnector = connectors.get(connection.clientId)
                if (storedConnector) {
                    connector = storedConnector
                    connector.off('algo_signData')
                    connector.off('algo_signTxn')
                    connector.off('disconnect')
                    connector.off('session_request')
                    connector.off('error')
                }
            }

            if (!connector) {
                connector = new WalletConnect({
                    ...restConnection,
                    clientMeta: PERA_CLIENT_META,
                })
            }

            connector.on('algo_signData', (error, payload) => {
                logger.debug('WC algo_signData received', {
                    error,
                    payload,
                    clientId: connector.clientId,
                })
                try {
                    handleSignData(
                        connector,
                        network,
                        error,
                        payload,
                        options?.onError ?? defaultErrorHandler,
                    )
                } catch (e) {
                    logger.error('Failed to sign data', { error: e })
                    connector.rejectRequest({
                        id: payload?.id,
                        error: e as Error,
                    })
                    options?.onError?.(e as Error)
                }
            })

            connector.on('algo_signTxn', (error, payload) => {
                logger.debug('WC algo_signTxn received', {
                    error,
                    payload,
                    clientId: connector.clientId,
                })
                try {
                    handleSignTransaction(
                        connector,
                        network,
                        error,
                        payload,
                        options?.onError ?? defaultErrorHandler,
                    )
                } catch (e) {
                    connector.rejectRequest({
                        id: payload?.id,
                        error: e as Error,
                    })
                    options?.onError?.(e as Error)
                }
            })

            connector.on('disconnect', () => {
                logger.debug('WC disconnect received')
                disconnect(connector.clientId, false)
            })

            connector.on('session_request', (error, payload) => {
                if (error) {
                    logger.error(error)
                    options?.onError?.(error)
                    return
                }
                const { peerMeta, chainId, permissions } = payload.params[0]

                logger.debug('WC session_request received', { payload })
                if (autoConnect) {
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

            connector.on('error', error => {
                logger.error('WC error received', { error })
                if (error) {
                    options?.onError?.(error)
                }
            })

            //accessing the connected property triggers a connection
            if (!connector.connected) {
                logger.debug(
                    'WC connect connector not connected, connecting...',
                )
            }

            connectors.set(connector.clientId, connector)
        },
        [addSessionRequest, options],
    )

    const reconnectAllSessions = useCallback(() => {
        if (!connections) {
            return
        }
        
        logger.debug("[WC] Reconnecting WC sessions", { count: connections.length})

        connections.forEach(connection => {
            connect({ connection })
        })
        setConnections(
            connections.map(connection => {
                if (!connection.clientId) {
                    return {
                        ...connection,
                        connected: false,
                    }
                }
                const connector = connectors.get(connection.clientId)
                return {
                    ...connection,
                    connected: connector?.connected ?? false,
                }
            }),
        )
    }, [connect, connections])

    const disconnect = useCallback(
        async (clientId: string, triggerDisconnect: boolean) => {
            const connector = connectors.get(clientId)
            if (connector && connector.connected && triggerDisconnect) {
                logger.debug('WC disconnect connector found, disconnecting...')
                await connector.killSession({
                    message: 'User disconnected',
                })
            }
            connectors.delete(clientId)
            setConnections(
                connections.filter(session => session.clientId !== clientId),
            )
            triggerWCRefresh()
        },
        [connections],
    )

    const approveSession = useCallback(
        (
            clientId: string,
            request: WalletConnectSessionRequest,
            addresses: string[],
        ) => {
            const existingSession = connections.find(
                conn => conn.clientId === clientId,
            )

            const connector = connectors.get(clientId)
            if (!connector) {
                throw new WalletConnectInvalidSessionError(
                    'No wallet connect session found.',
                )
            }

            connector.approveSession({
                chainId: request.chainId,
                accounts: addresses,
            })

            const replacementSession = {
                ...existingSession,
                ...connector,
                clientId,
                createdAt: new Date(),
                lastActiveAt: new Date(),
                session: {
                    ...connector.session,
                    permissions: request.permissions,
                    clientId,
                },
            }

            setConnections([
                ...connections.filter(conn => conn.clientId !== clientId),
                replacementSession,
            ])
            triggerWCRefresh()
        },
        [connections],
    )

    const rejectSession = useCallback(
        (clientId: string) => {
            const connector = connectors.get(clientId)
            if (!connector) {
                throw new WalletConnectInvalidSessionError(
                    'No wallet connect session found.',
                )
            }

            connector.rejectSession()

            setConnections(
                connections.filter(conn => conn.clientId !== clientId),
            )
            triggerWCRefresh()
        },
        [connections],
    )

    const deleteAllSessions = useCallback(async () => {
        const promises = connections.map(conn => {
            if (conn.clientId) {
                return disconnect(conn.clientId, true)
            }
            return Promise.resolve()
        })
        await Promise.all(promises)
        setConnections([])
        triggerWCRefresh()
    }, [connections])

    return {
        connections,
        initWalletConnect,
        reconnectAllSessions,
        connect,
        disconnect,
        approveSession,
        rejectSession,
        deleteAllSessions,
    }
}
