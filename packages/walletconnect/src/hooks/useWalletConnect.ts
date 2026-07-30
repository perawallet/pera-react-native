/*
 Copyright 2022-2026 Pera Wallet, LDA
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
    ALL_PERMISSIONS,
    PERA_CLIENT_META,
    WC_DELIVERY_TIMEOUT_MS,
} from '../constants'
import {
    WalletConnectError,
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSessionRequestExpiredError,
} from '../errors'
import {
    AlgorandChainId,
    type WalletConnectConnection,
    type WalletConnectSessionRequest,
} from '../models'
import { useWalletConnectStore } from '../store'
import {
    ensureConnectorReady,
    forgetConnector,
    getConnector,
    registerConnector,
    setConnectorHandlerBinder,
} from '../connection'
import { isSessionRequestFresh } from './useWalletConnectSessionRequests'
import WalletConnect from '@perawallet/walletconnect'
import { useCallback, useEffect, useRef } from 'react'
import { useWalletConnectSessionRequests } from './useWalletConnectSessionRequests'
import { useWalletConnectHandlers } from './useWalletConnectHandlers'
import {
    logger,
    type Network,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { getExpectedChainId } from '../utils/expectedChainId'

/**
 * Surface a WalletConnect error to the UI. We go through the store rather
 * than per-instance callbacks so the path doesn't depend on which
 * `useWalletConnect` invocation registered the connector handlers — the
 * app's `WalletConnectProvider` reads `connectionError` and dispatches
 * (toast for network mismatch, bottom sheet otherwise).
 */
const surfaceError = (error: Error, clientId?: string) => {
    logger.error('An error occurred when handling a wallet connect message', {
        error,
    })
    // Stamp the originating connector so consumers can scope handling to a
    // single pairing/session (see `getConnectionErrorClientId`). `connectionError`
    // is one shared store field written from every connector.
    if (clientId) {
        ;(error as { clientId?: string }).clientId = clientId
    }
    useWalletConnectStore.getState().setConnectionError(error)
}

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
    // the closures captured at `connect()` time are frozen; the refs keep the
    // live handlers reading current values without recreating the connector.
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
            // Return the connector id so a caller pairing via QR can scope its
            // wait to this connector's session_request / connection error
            // rather than reacting to any WalletConnect activity.
            return connector.clientId
        },
        [],
    )

    const connectSessions = useCallback(() => {
        if (!connections) {
            return
        }

        connections.forEach(connection => {
            if (!connection.clientId || getConnector(connection.clientId)) {
                return
            }

            logger.debug('[WC] Establishing stored session', {
                clientId: connection.clientId,
            })

            // A missing/empty bridge makes the WC v1 Connector throw synchronously — skip it.
            connect({ connection }).catch(error => {
                logger.error(
                    '[WC] Failed to establish stored session — skipping',
                    { clientId: connection.clientId, error },
                )
            })
        })
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
        async (
            clientId: string,
            request: WalletConnectSessionRequest,
            addresses: string[],
        ): Promise<void> => {
            const existingSession = connections.find(
                conn => conn.clientId === clientId,
            )

            // The dApp's side of the handshake expires long before ours —
            // approving a stale queued request can only fake-succeed.
            if (!isSessionRequestFresh(request)) {
                throw new WalletConnectSessionRequestExpiredError()
            }

            // WC v1 silently queues into a dead socket, so "Connected!"
            // must mean the approval was handed to an OPEN socket. Revive
            // first; failure throws the retryable timeout error and no
            // session is persisted (the dApp never heard back, so the
            // settings list must not claim it did).
            const connector = await ensureConnectorReady(
                clientId,
                WC_DELIVERY_TIMEOUT_MS,
            )

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
        async (clientId: string): Promise<void> => {
            // A reject on a genuinely pending handshake must always clean local
            // state, even when delivery fails on a dead socket. But if the
            // connector is already CONNECTED, rejectSession throws — and that
            // reject is a repeat-handshake attempt, not the pending one the
            // user is declining. Dropping the stored entry there would
            // force-delete a live session while the connector stays connected
            // (store desync, PERA-4713). Only remove on genuine cleanup.
            const wasConnected = getConnector(clientId)?.connected ?? false
            let delivered = false
            try {
                const connector = await ensureConnectorReady(
                    clientId,
                    WC_DELIVERY_TIMEOUT_MS,
                )
                connector.rejectSession()
                delivered = true
            } catch (error) {
                // The user explicitly declined — never trap them behind a
                // dead socket. Drop the request locally and tell them the
                // dApp may not have heard (it times out on its own side).
                logger.warn('[WC] session reject delivery failed', {
                    clientId,
                    error,
                })
                surfaceError(
                    new WalletConnectError(
                        "Couldn't notify the dApp of the rejection. It may keep waiting until it times out.",
                        error as Error,
                    ),
                    clientId,
                )
            }

            if (delivered || !wasConnected) {
                setConnections(
                    connections.filter(conn => conn.clientId !== clientId),
                )
            }
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
                surfaceError(e as Error, connector.clientId)
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
                surfaceError(e as Error, connector.clientId)
            }
        })

        connector.on('disconnect', () => {
            logger.debug('WC disconnect received')
            void disconnect(connector.clientId, false)
        })

        connector.on('session_request', (error, payload) => {
            if (error) {
                logger.error(error)
                surfaceError(error, connector.clientId)
                return
            }

            // A settled WC v1 session must never renegotiate its identity.
            // Once the connector is connected and we already hold a stored
            // session for it, a fresh session_request is a peerMeta-overwrite
            // attempt: the library rewrites peerMeta/peerId before this fires,
            // so refuse the frame outright rather than re-opening an approval
            // sheet or reacting to a poisoned handshake (PERA-4713).
            const hasStoredSession = useWalletConnectStore
                .getState()
                .walletConnectConnections.some(
                    conn => conn.clientId === connector.clientId,
                )
            if (connector.connected && hasStoredSession) {
                logger.warn(
                    'WC ignoring session_request on an already-connected session',
                    { clientId: connector.clientId },
                )
                surfaceError(
                    new WalletConnectInvalidSessionError(
                        'Ignored a repeat connection request on an active session.',
                    ),
                    connector.clientId,
                )
                return
            }

            const { peerMeta, chainId, permissions } = payload.params[0]

            logger.debug('WC session_request received', { payload })

            const currentNetwork = networkRef.current
            const expectedChainId = getExpectedChainId(currentNetwork)

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
                // `rejectSession()` throws on an already-connected connector;
                // guarding it keeps the throw from escaping before the error is
                // surfaced, which is what let the mismatch branch go silent and
                // masked the peerMeta poisoning (PERA-4713).
                if (!connector.connected) {
                    connector.rejectSession()
                }
                surfaceError(
                    new WalletConnectInvalidNetworkError(),
                    connector.clientId,
                )
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
                surfaceError(error, connector.clientId)
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

    return {
        connections,
        connectSessions,
        connect,
        disconnect,
        approveSession,
        rejectSession,
        deleteAllSessions,
    }
}
