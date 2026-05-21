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
import {
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
} from '../errors'
import {
    AlgorandChainId,
    WalletConnectConnection,
    WalletConnectSessionRequest,
} from '../models'
import { useWalletConnectStore } from '../store'
import {
    forgetConnector,
    getConnector,
    registerConnector,
    setConnectorHandlerBinder,
} from '../connection'
import WalletConnect from '@walletconnect/client'
import { createRef, useCallback, useEffect, useRef } from 'react'
import { useWalletConnectSessionRequests } from './useWalletConnectSessionRequests'
import { useWalletConnectHandlers } from './useWalletConnectHandlers'
import {
    logger,
    Network,
    Networks,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useSigningAccounts } from '@perawallet/wallet-core-accounts'

/**
 * Surface a WalletConnect error to the UI. We go through the store rather
 * than per-instance callbacks so the path doesn't depend on which
 * `useWalletConnect` invocation registered the connector handlers — the
 * app's `WalletConnectProvider` reads `connectionError` and dispatches
 * (toast for network mismatch, bottom sheet otherwise).
 */
const surfaceError = (error: Error) => {
    logger.error('An error occurred when handling a wallet connect message', {
        error,
    })
    useWalletConnectStore.getState().setConnectionError(error)
}

const walletConnectRefreshCounter = createRef<number>()

const triggerWCRefresh = () => {
    walletConnectRefreshCounter.current =
        (walletConnectRefreshCounter.current ?? 0) + 1
}

/** Re-binds the dApp request handlers onto a (re)created connector. */
type BindRequestHandlers = (
    connector: WalletConnect,
    autoConnect?: boolean,
) => void

export const useWalletConnect = (network: Network) => {
    const connections = useWalletConnectStore(
        state => state.walletConnectConnections,
    )
    const setConnections = useWalletConnectStore(
        state => state.setWalletConnectConnections,
    )
    const { addSessionRequest } = useWalletConnectSessionRequests()
    const { handleSignData, handleSignTransaction } = useWalletConnectHandlers()
    const signingAccounts = useSigningAccounts()

    // Refs let the connector's registered event handlers always read the
    // latest values. Without this, network changes don't propagate because
    // the closures captured at `connect()` time are frozen until
    // reconnectAllSessions runs again.
    const networkRef = useRef(network)
    networkRef.current = network
    const handleSignDataRef = useRef(handleSignData)
    handleSignDataRef.current = handleSignData
    const handleSignTransactionRef = useRef(handleSignTransaction)
    handleSignTransactionRef.current = handleSignTransaction
    const accountsRef = useRef(accounts)
    accountsRef.current = accounts
    const signingAccountsRef = useRef(signingAccounts)
    signingAccountsRef.current = signingAccounts

    // Holds the latest `bindRequestHandlers`. The connector registry
    // recreates connectors on socket recovery and re-binds handlers
    // through this ref, so a recovered connector's handlers still read
    // fresh hook state (network, accounts, callbacks).
    const bindRequestHandlersRef = useRef<BindRequestHandlers>(() => {})

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
            logger.debug('[WC] Reconnecting', {
                connection,
                network: networkRef.current,
            })
            const { autoConnect, ...restConnection } = connection

            let connector: Optional<WalletConnect> = connection.clientId
                ? getConnector(connection.clientId)
                : undefined

            if (!connector) {
                connector = new WalletConnect({
                    ...restConnection,
                    clientMeta: PERA_CLIENT_META,
                })
            }

            // Bind (or re-bind, for a reused connector) the dApp request
            // handlers, then adopt the connector into the shared registry
            // so its socket liveness is tracked for delivery recovery.
            bindRequestHandlersRef.current(connector, autoConnect)
            registerConnector(connector.clientId, connector)
        },
        [],
    )

    const reconnectAllSessions = useCallback(() => {
        if (!connections) {
            return
        }

        logger.debug('[WC] Reconnecting WC sessions', {
            count: connections.length,
        })

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
                const connector = getConnector(connection.clientId)
                return {
                    ...connection,
                    connected: connector?.connected ?? false,
                }
            }),
        )
    }, [connect, connections])

    const disconnect = useCallback(
        async (clientId: string, triggerDisconnect: boolean) => {
            const connector = getConnector(clientId)
            if (connector && connector.connected && triggerDisconnect) {
                logger.debug('WC disconnect connector found, disconnecting...')
                await connector.killSession({
                    message: 'User disconnected',
                })
            }
            // forgetConnector drops the connector from the registry and
            // tombstones the session, so any in-flight socket recovery
            // for it aborts instead of resurrecting a disconnected peer.
            forgetConnector(clientId)
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

            const connector = getConnector(clientId)
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
            const connector = getConnector(clientId)
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

    /**
     * Registers the dApp request handlers on a connector. Always
     * `off`s first so it is safe to call on a reused connector (clears
     * the previous binding) or a freshly recreated one (no-op).
     *
     * `autoConnect` is only meaningful for a brand-new session handshake;
     * the connector registry re-binds recovered (already-established)
     * connectors with it omitted, where `session_request` never fires.
     */
    const bindRequestHandlers: BindRequestHandlers = (
        connector,
        autoConnect,
    ) => {
        connector.off('algo_signData')
        connector.off('algo_signTxn')
        connector.off('disconnect')
        connector.off('session_request')
        connector.off('error')

        connector.on('algo_signData', (error, payload) => {
            logger.debug('WC algo_signData received', {
                error,
                payload,
                clientId: connector.clientId,
            })
            try {
                handleSignDataRef.current(
                    connector,
                    networkRef.current,
                    error,
                    payload,
                )
            } catch (e) {
                logger.error('Failed to sign data', { error: e })
                connector.rejectRequest({
                    id: payload?.id,
                    error: e as Error,
                })
                surfaceError(e as Error)
            }
        })

        connector.on('algo_signTxn', (error, payload) => {
            logger.debug('WC algo_signTxn received', {
                error,
                payload,
                clientId: connector.clientId,
            })
            try {
                handleSignTransactionRef.current(
                    connector,
                    networkRef.current,
                    error,
                    payload,
                )
            } catch (e) {
                connector.rejectRequest({
                    id: payload?.id,
                    error: e as Error,
                })
                surfaceError(e as Error)
            }
        })

        connector.on('disconnect', () => {
            logger.debug('WC disconnect received')
            disconnect(connector.clientId, false)
        })

        connector.on('session_request', (error, payload) => {
            if (error) {
                logger.error(error)
                surfaceError(error)
                return
            }
            const { peerMeta, chainId, permissions } = payload.params[0]

            logger.debug('WC session_request received', { payload })

            const currentNetwork = networkRef.current
            const expectedChainId =
                currentNetwork === Networks.testnet
                    ? AlgorandChainId.testnet
                    : AlgorandChainId.mainnet

            if (
                chainId !== AlgorandChainId.all &&
                chainId !== expectedChainId
            ) {
                logger.debug('WC session_request rejected: wrong network', {
                    clientId: connector.clientId,
                    chainId,
                    expectedChainId,
                    network: currentNetwork,
                })
                connector.rejectSession()
                surfaceError(new WalletConnectInvalidNetworkError())
                return
            }

            if (autoConnect) {
                // Filter to signable accounts so later requests don't fail
                // with an opaque "Invalid signer".
                approveSession(
                    connector.clientId,
                    payload.params[0],
                    signingAccountsRef.current.map(a => a.address),
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
                surfaceError(error)
            }
        })
    }
    bindRequestHandlersRef.current = bindRequestHandlers

    // Register the handler binder once so the connector registry can
    // re-bind request handlers onto a connector it recreates during
    // socket recovery. `autoConnect` is intentionally omitted — recovered
    // connectors are for already-established sessions.
    useEffect(() => {
        setConnectorHandlerBinder(connector =>
            bindRequestHandlersRef.current(connector),
        )
    }, [])

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
