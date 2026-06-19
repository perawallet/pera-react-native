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
    type WalletConnectConnection,
    type WalletConnectSessionRequest,
} from '../models'
import { useWalletConnectStore } from '../store'
import {
    forgetConnector,
    getConnector,
    registerConnector,
    setConnectorHandlerBinder,
} from '../connection'
import WalletConnect from '@perawallet/walletconnect'
import { useCallback, useEffect, useRef } from 'react'
import { useWalletConnectSessionRequests } from './useWalletConnectSessionRequests'
import { useWalletConnectHandlers } from './useWalletConnectHandlers'
import {
    logger,
    type Network,
    Networks,
    type Optional,
} from '@perawallet/wallet-core-shared'

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

/**
 * Module-level latch so the cold-start `reconnectAllSessions` runs exactly
 * once across the entire process — even when several components mount
 * `useWalletConnect` simultaneously. Without this, every mounted consumer
 * would re-iterate every stored connection, churning the store and stacking
 * up rebind cycles.
 */
let coldStartReconnectDone = false

/** Re-binds the dApp request handlers onto a (re)created connector. */
type BindRequestHandlers = (connector: WalletConnect) => void

export const useWalletConnect = (network: Network) => {
    const connections = useWalletConnectStore(
        state => state.walletConnectConnections,
    )
    const setConnections = useWalletConnectStore(
        state => state.setWalletConnectConnections,
    )
    const { addSessionRequest } = useWalletConnectSessionRequests()
    const { handleSignData, handleSignTransaction } = useWalletConnectHandlers()

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

    // Holds the latest `bindRequestHandlers`. The connector registry
    // recreates connectors on socket recovery and re-binds handlers
    // through this ref, so a recovered connector's handlers still read
    // fresh hook state (network, accounts, callbacks).
    const bindRequestHandlersRef = useRef<BindRequestHandlers>(() => {})

    // Kept as a stable identity for callers that may already wire it into
    // an effect dep array. Cold-start reconnect now runs once per process
    // (see effect below), so this is a no-op outside that initial pass.
    const initWalletConnect = useCallback(() => {}, [])

    const connect = useCallback(
        async ({ connection }: { connection: WalletConnectConnection }) => {
            logger.debug('[WC] Reconnecting', {
                connection,
                network: networkRef.current,
            })
            let connector: Optional<WalletConnect> = connection.clientId
                ? getConnector(connection.clientId)
                : undefined

            if (!connector) {
                connector = new WalletConnect({
                    ...connection,
                    clientMeta: PERA_CLIENT_META,
                })
            }

            // Bind (or re-bind, for a reused connector) the dApp request
            // handlers, then adopt the connector into the shared registry
            // so its socket liveness is tracked for delivery recovery.
            bindRequestHandlersRef.current(connector)
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
            // Fire-and-forget, but never unguarded: a stored connection with a
            // missing/empty bridge makes the WC v1 `Connector` constructor throw
            // synchronously, which would otherwise surface as an uncaught promise
            // rejection on cold start. Log and skip the bad session instead.
            connect({ connection }).catch(error => {
                logger.error(
                    '[WC] Failed to reconnect stored session — skipping',
                    { clientId: connection.clientId, error },
                )
            })
        })

        // Only push a new array if at least one connection's `connected`
        // flag actually flipped. Unconditional `setConnections` here
        // ticks every subscriber on every reconnect cycle and drives a
        // render storm across the multiple components that call
        // useWalletConnect.
        let changed = false
        const next = connections.map(connection => {
            const nextConnected = connection.clientId
                ? (getConnector(connection.clientId)?.connected ?? false)
                : false
            if (nextConnected !== connection.connected) {
                changed = true
                return { ...connection, connected: nextConnected }
            }
            return connection
        })
        if (changed) {
            setConnections(next)
        }
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

            // Persist only clean metadata. Spreading `connector` would
            // copy its private `_socket` / `_transport` / `_eventManager`
            // refs into the zustand store — polluting the state tree with
            // live socket handles that re-render every subscriber on each
            // reconnect cycle. The live connector itself stays in the
            // module-level registry, queryable via `getConnector(clientId)`.
            const replacementSession: WalletConnectConnection = {
                clientId,
                version: connector.version,
                bridge: connector.bridge,
                connected: connector.connected,
                session: {
                    ...connector.session,
                    permissions: request.permissions,
                    clientId,
                },
                createdAt: existingSession?.createdAt ?? new Date(),
                lastActiveAt: new Date(),
            }

            setConnections([
                ...connections.filter(conn => conn.clientId !== clientId),
                replacementSession,
            ])
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
    }, [connections, disconnect])

    /**
     * Registers the dApp request handlers on a connector. Always
     * `off`s first so it is safe to call on a reused connector (clears
     * the previous binding) or a freshly recreated one (no-op).
     */
    const bindRequestHandlers: BindRequestHandlers = connector => {
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
            void disconnect(connector.clientId, false)
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

            // A session is only ever established through the user-facing
            // approval sheet, which is where account selection happens. The
            // wallet never auto-approves a handshake (that would hand the
            // dApp account addresses with no review).
            addSessionRequest({
                peerMeta,
                chainId,
                permissions: permissions ?? ALL_PERMISSIONS,
                clientId: connector.clientId,
            })
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
    // socket recovery.
    useEffect(() => {
        setConnectorHandlerBinder(connector =>
            bindRequestHandlersRef.current(connector),
        )
    }, [])

    // Cold-start reconnect: re-establish a connector for every persisted
    // connection so handlers are bound and the bridge socket is alive
    // before the dApp starts emitting requests. Runs once per process
    // (the latch is module-level), regardless of how many components
    // mount `useWalletConnect`. State changes during a session
    // (approve/disconnect/etc.) don't re-trigger this — they handle
    // registry bookkeeping inline.
    useEffect(() => {
        if (coldStartReconnectDone) return
        coldStartReconnectDone = true
        reconnectAllSessions()
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
