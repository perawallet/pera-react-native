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

import type WalletConnect from '@perawallet/walletconnect'
import type { IWalletConnectSession } from '@perawallet/walletconnect'
import {
    logger,
    Networks,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionId,
    ConnectionOrigin,
    ConnectionPeer,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import type {
    ConnectionErrorScope,
    ConnectionHandlerContext,
    ConnectionProposal,
    WalletOperationType,
} from '@perawallet/wallet-core-connections'
import {
    abandonPairing as abandonConnectorPairing,
    BOUND_EVENTS,
    clearConnectorHandlerBinder,
    createWalletConnectConnector,
    ensureConnectorReady,
    forgetConnector,
    getConnector,
    registerConnector,
    setConnectorHandlerBinder,
    teardownConnector,
} from '../connection'
import { isAlgorandPermission } from '../models'
import {
    ALL_PERMISSIONS,
    PERA_CLIENT_META,
    SESSION_REQUEST_TTL_MS,
    WC_DELIVERY_TIMEOUT_MS,
} from '../shared/constants'
import { isChainIdAcceptable } from '../shared/chain'
import { toPeer } from '../shared/peer'
import { redactWalletConnectUri, walletConnectLogContext } from '../shared/uri'
import {
    WalletConnectBridgeConnectionError,
    WalletConnectError,
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSessionRequestExpiredError,
    WalletConnectSignRequestError,
} from '../shared/errors'
import {
    gateSignDataRequest,
    gateSignTxnRequest,
    type GateResult,
} from '../validation/inboundRequestGate'
import {
    isV1PairingUri,
    isWalletConnectV1Connection,
    WALLET_CONNECT_V1_KIND,
    type WalletConnectV1Connection,
    type WalletConnectV1Handler,
} from './connection'
import {
    asSessionRequestParams,
    asWcRequest,
    legacyItemChainIdsAcceptable,
    readErrorDetail,
    toClientMeta,
    toWireResult,
    type WcRequest,
} from './wire'
import { commitSessionKey, removeSessionKey, withSessionKey } from './secrets'
import { startReconnectSweep } from './reconnectSweep'

// The 4160 wildcard expands to every network, and TestNet's id also covers `custom`.
const networksForChainId = (chainId: number): Network[] =>
    Object.values(Networks).filter(network =>
        isChainIdAcceptable(chainId, network),
    )

export type CreateWalletConnectV1HandlerOptions = {
    /**
     * Injected rather than read from a store: a store default would drag the
     * blockchain package into every importer's module graph, `apps/browser`
     * included.
     */
    getNetwork: () => Network
}

/**
 * WalletConnect v1 as one implementation of {@link ConnectionHandler}. v1 is
 * one bridge WebSocket per session, so this handler owns N connectors (in
 * `../connection`'s registry) rather than a single shared relay.
 */
export const createWalletConnectV1Handler = (
    options: CreateWalletConnectV1HandlerOptions,
): WalletConnectV1Handler => {
    const { getNetwork } = options

    let context: Nullable<ConnectionHandlerContext> = null
    let stopSweep: Nullable<() => void> = null
    // Keyed by clientId: on v1 the connector IS the pairing.
    const pendingOrigins = new Map<string, ConnectionOrigin>()

    const requireContext = (): ConnectionHandlerContext => {
        if (!context) {
            throw new WalletConnectError(
                'The WalletConnect v1 handler was used before initialize()',
            )
        }
        return context
    }

    const store = (): ConnectionStoreAPI => requireContext().store

    const reportError = (error: Error, scope?: ConnectionErrorScope): void => {
        logger.error(error, scope)
        context?.onError(error, scope)
    }

    const pairingScope = (clientId: string): ConnectionErrorScope => ({
        pairingId: clientId,
    })
    const connectionScope = (id: ConnectionId): ConnectionErrorScope => ({
        connectionId: id,
    })
    // `connected` flips inside `approveSession`: exactly "has this pairing become a session".
    const scopeFor = (connector: WalletConnect): ConnectionErrorScope =>
        connector.connected
            ? connectionScope(connector.clientId)
            : pairingScope(connector.clientId)

    // The SDK invokes listeners with nowhere to put a rejected promise; unhandled,
    // it escapes to the platform's global handler.
    const onListenerFailure =
        (connector: WalletConnect) =>
        (listenerError: unknown): void => {
            reportError(
                listenerError instanceof Error
                    ? listenerError
                    : new Error(String(listenerError)),
                scopeFor(connector),
            )
        }

    const connectionFor = async (
        clientId: string,
    ): Promise<Nullable<WalletConnectV1Connection>> => {
        const record = await store().get(clientId)
        if (!record) return null
        return isWalletConnectV1Connection(record) ? record : null
    }

    // Fire-and-forget: never throws back into a socket listener. A failed
    // revival leaves the dApp timing out, as a send into a dead socket would.
    const rejectToPeer = (
        clientId: string,
        requestId: number,
        error: Error,
    ): void => {
        void ensureConnectorReady(clientId, WC_DELIVERY_TIMEOUT_MS)
            .then(connector =>
                connector.rejectRequest({ id: requestId, error }),
            )
            .catch((deliveryError: unknown) => {
                logger.warn('[WC v1] reject delivery failed', {
                    clientId,
                    requestId,
                    error: deliveryError,
                })
            })
    }

    // Requests are user-paced, so this needs no debounce. Re-read first so a
    // disconnect that already landed is not undone; a remove that lands between
    // the read and the write can still be, and the next reconcile drops it.
    const recordActivity = (id: ConnectionId): void => {
        void (async () => {
            const current = await store().get(id)
            if (!current) return
            await store().upsert({ ...current, lastActiveAt: Date.now() })
        })().catch((error: unknown) => {
            logger.warn('[WC v1] failed to record connection activity', {
                clientId: id,
                error,
            })
        })
    }

    const emitRequest = (input: {
        connection: WalletConnectV1Connection
        requestId: number
        type: WalletOperationType
        params: unknown
    }): void => {
        const { connection, requestId } = input
        // Without this the settings list, which sorts on `lastActiveAt`, stays
        // in approval order for the life of the connection.
        recordActivity(connection.id)

        // A backgrounded v1 socket swallows sends silently, so delivery goes
        // through a socket verified open; a failed revival rejects so the
        // signing pipeline knows to retry instead of reporting a fake success.
        const deliver = async (
            send: (connector: WalletConnect) => void,
        ): Promise<void> => {
            const connector = await ensureConnectorReady(
                connection.id,
                WC_DELIVERY_TIMEOUT_MS,
            )
            send(connector)
        }

        requireContext().onMessage({
            kind: 'request',
            connectionId: connection.id,
            correlationId: String(requestId),
            // Becomes ARC-0001's `authorizedAddresses`: what stops a session
            // approved for account A signing for B.
            authorizedAccounts: connection.accounts,
            // The approval-time snapshot, not the live `peerMeta` a dApp can
            // overwrite afterwards; it is the anti-spoofing `sourceMetadata`.
            peer: connection.peer,
            rawOperation: { type: input.type, params: input.params },
            respond: result =>
                deliver(connector =>
                    connector.approveRequest({
                        id: requestId,
                        result: toWireResult(result),
                    }),
                ),
            reject: error =>
                deliver(connector =>
                    connector.rejectRequest({ id: requestId, error }),
                ),
        })
    }

    /** Shared prologue for both signing methods. */
    const openRequest = async (
        connector: WalletConnect,
        method: string,
        error: Nullable<Error>,
        payload: unknown,
    ): Promise<
        Nullable<{
            request: WcRequest
            connection: WalletConnectV1Connection
        }>
    > => {
        const clientId = connector.clientId
        const request = asWcRequest(payload)

        if (error) {
            const wrapped = new WalletConnectSignRequestError(
                `An error occurred while handling a WalletConnect ${method} request.`,
                error,
            )
            if (request) rejectToPeer(clientId, request.id, wrapped)
            reportError(wrapped, connectionScope(clientId))
            return null
        }
        if (!request) {
            // No id, no way to address a response.
            reportError(
                new WalletConnectSignRequestError(
                    `Dropped a ${method} frame with no request id`,
                ),
                connectionScope(clientId),
            )
            return null
        }

        const connection = await connectionFor(clientId)
        if (!connection) {
            const notFound = new WalletConnectInvalidSessionError(
                'No session found',
            )
            rejectToPeer(clientId, request.id, notFound)
            reportError(notFound, connectionScope(clientId))
            return null
        }

        return { request, connection }
    }

    const declineRequest = (
        clientId: string,
        requestId: number,
        reason: string,
    ): void => {
        const rejection = new WalletConnectSignRequestError(reason)
        rejectToPeer(clientId, requestId, rejection)
        reportError(rejection, connectionScope(clientId))
    }

    const handleSignTxn = async (
        connector: WalletConnect,
        error: Nullable<Error>,
        payload: unknown,
    ): Promise<void> => {
        const opened = await openRequest(
            connector,
            'algo_signTxn',
            error,
            payload,
        )
        if (!opened) return
        const { request, connection } = opened

        const verdict = gateSignTxnRequest({
            payload,
            network: getNetwork(),
            sessionChainId: connection.metadata.chainId,
            knownAddresses: connection.accounts,
        })
        if (!verdict.ok) {
            declineRequest(connection.id, request.id, verdict.reason)
            return
        }

        emitRequest({
            connection,
            requestId: request.id,
            type: 'sign-transactions',
            // The gate proved `params[0]` is a non-empty array; the registry parses it.
            params: Array.isArray(request.params)
                ? request.params[0]
                : undefined,
        })
    }

    const handleSignData = async (
        connector: WalletConnect,
        error: Nullable<Error>,
        payload: unknown,
    ): Promise<void> => {
        const opened = await openRequest(
            connector,
            'algo_signData',
            error,
            payload,
        )
        if (!opened) return
        const { request, connection } = opened
        const network = getNetwork()

        // `gateSignDataRequest` rejects the legacy array shape outright (the
        // browser extension never had it), so that branch gets only the
        // shared chain check; the registry validates its payload.
        const verdict: GateResult = Array.isArray(request.params)
            ? isChainIdAcceptable(connection.metadata.chainId, network) &&
              legacyItemChainIdsAcceptable(request.params, network)
                ? { ok: true }
                : {
                      ok: false,
                      reason: 'chain id not acceptable on the active network',
                  }
            : gateSignDataRequest({
                  payload,
                  network,
                  sessionChainId: connection.metadata.chainId,
              })
        if (!verdict.ok) {
            declineRequest(connection.id, request.id, verdict.reason)
            return
        }

        emitRequest({
            connection,
            requestId: request.id,
            type: 'sign-data',
            params: request.params,
        })
    }

    const approveProposal = async (input: {
        clientId: string
        chainId: number
        peer: ConnectionPeer
        expiresAt: number
        handshakeId: number
        permissions: string[]
        accounts: string[]
    }): Promise<Connection> => {
        // The dApp's side expires long before ours; approving late can only fake-succeed.
        if (Date.now() > input.expiresAt) {
            pendingOrigins.delete(input.clientId)
            throw new WalletConnectSessionRequestExpiredError()
        }

        // Revive before persisting: a failed delivery must leave nothing that
        // claims a session the dApp never heard about.
        const connector = await ensureConnectorReady(
            input.clientId,
            WC_DELIVERY_TIMEOUT_MS,
        )
        connector.approveSession({
            chainId: input.chainId,
            accounts: input.accounts,
        })

        const secretRef = await commitSessionKey(
            input.clientId,
            connector.session.key,
        )

        const existing = await store().get(input.clientId)
        // A re-approval without an origin must not erase the stored one.
        const origin = pendingOrigins.get(input.clientId) ?? existing?.origin
        const now = Date.now()
        const connection: WalletConnectV1Connection = {
            id: input.clientId,
            kind: WALLET_CONNECT_V1_KIND,
            name: input.peer.name,
            peer: input.peer,
            accounts: input.accounts,
            secretRef,
            status: 'active',
            createdAt: existing?.createdAt ?? now,
            lastActiveAt: now,
            ...(origin ? { origin } : {}),
            metadata: {
                bridge: connector.bridge,
                handshakeTopic: connector.handshakeTopic,
                peerId: connector.peerId,
                chainId: input.chainId,
                handshakeId: input.handshakeId,
                permissions: input.permissions,
            },
        }
        await store().upsert(connection)
        pendingOrigins.delete(input.clientId)
        return connection
    }

    // The SDK's `rejectSession` fires 'disconnect' synchronously (our listener
    // forgets the connector) and leaves the transport open, so a lookup finds
    // nothing: tear the captured connector down by reference, or a late
    // `session_request` pops a ghost approval sheet minutes later.
    const abandonDeclinedPairing = (
        clientId: string,
        connector: Nullable<WalletConnect>,
    ): void => {
        pendingOrigins.delete(clientId)
        if (connector) {
            teardownConnector(connector)
            forgetConnector(clientId)
            return
        }
        abandonConnectorPairing(clientId)
    }

    const rejectProposal = async (
        clientId: string,
        reason?: string,
    ): Promise<void> => {
        let connector: Nullable<WalletConnect> = null
        try {
            connector = await ensureConnectorReady(
                clientId,
                WC_DELIVERY_TIMEOUT_MS,
            )
            connector.rejectSession(reason ? { message: reason } : undefined)
        } catch (error) {
            // Never trap a user who declined behind a dead socket; the dApp times out.
            logger.warn('[WC v1] session reject delivery failed', {
                clientId,
                error,
            })
            reportError(
                new WalletConnectError(
                    "Couldn't notify the dApp of the rejection. It may keep waiting until it times out.",
                    error instanceof Error ? error : undefined,
                ),
                pairingScope(clientId),
            )
        } finally {
            abandonDeclinedPairing(clientId, connector)
        }
    }

    const handleSessionRequest = async (
        connector: WalletConnect,
        error: Nullable<Error>,
        payload: unknown,
    ): Promise<void> => {
        const clientId = connector.clientId
        if (error) {
            reportError(error, scopeFor(connector))
            return
        }

        const request = asWcRequest(payload)
        const stored = await connectionFor(clientId)

        // The library rewrites peerMeta/peerId before this fires, so a fresh
        // handshake on a live session is refused, never re-proposed on poisoned metadata.
        if (connector.connected && stored) {
            if (
                request &&
                stored.metadata.handshakeId !== undefined &&
                stored.metadata.handshakeId === request.id
            ) {
                // The bridge replays a topic's pending history on every
                // re-subscription. Compare against the id snapshotted at
                // approval: the library overwrites `connector.handshakeId` from this frame.
                logger.debug(
                    '[WC v1] ignoring a replay of the approved handshake',
                    {
                        clientId,
                        requestId: request.id,
                    },
                )
                return
            }
            reportError(
                new WalletConnectInvalidSessionError(
                    'Ignored a repeat connection request on an active session.',
                ),
                connectionScope(clientId),
            )
            return
        }

        const params = asSessionRequestParams(
            request && Array.isArray(request.params)
                ? request.params[0]
                : undefined,
        )
        if (!request || !params) {
            reportError(
                new WalletConnectInvalidSessionError(
                    'Dropped a malformed WalletConnect handshake',
                ),
                pairingScope(clientId),
            )
            return
        }

        const network = getNetwork()
        const { chainId } = params
        if (
            typeof chainId !== 'number' ||
            !isChainIdAcceptable(chainId, network)
        ) {
            // `rejectSession()` throws on an already-connected connector.
            if (!connector.connected) {
                connector.rejectSession()
                abandonDeclinedPairing(clientId, connector)
            }
            reportError(
                new WalletConnectInvalidNetworkError(),
                pairingScope(clientId),
            )
            return
        }

        const peer = toPeer(params.peerMeta)
        const expiresAt = Date.now() + SESSION_REQUEST_TTL_MS
        const methods = params.permissions
            ? params.permissions.filter(isAlgorandPermission)
            : [...ALL_PERMISSIONS]
        const proposal: ConnectionProposal = {
            kind: WALLET_CONNECT_V1_KIND,
            proposalId: `${clientId}:${request.id}`,
            pairingId: clientId,
            peer,
            requested: {
                networks: networksForChainId(chainId),
                methods,
            },
            expiresAt,
            approve: accounts =>
                approveProposal({
                    clientId,
                    chainId,
                    peer,
                    expiresAt,
                    handshakeId: request.id,
                    permissions: methods,
                    accounts,
                }),
            reject: reason => rejectProposal(clientId, reason),
        }

        requireContext().onProposal(proposal)
    }

    const forgetSession = async (id: ConnectionId): Promise<void> => {
        // Tombstoned so an in-flight socket recovery aborts instead of resurrecting the peer.
        forgetConnector(id)
        await removeSessionKey(id).catch((secretError: unknown) => {
            logger.warn('[WC v1] failed to remove a stored session key', {
                connectionId: id,
                error: secretError,
            })
        })
    }

    const handlePeerDisconnect = async (id: ConnectionId): Promise<void> => {
        await forgetSession(id)
        // The registry removes the record, whichever side ended the session.
        context?.onDisconnected(id)
    }

    // Always `off`s first, so rebinding a reused connector displaces rather than doubles.
    const bindHandlers = (connector: WalletConnect): void => {
        for (const event of BOUND_EVENTS) connector.off(event)

        const onFailure = onListenerFailure(connector)

        connector.on(
            'session_request',
            (eventError: Nullable<Error>, payload: unknown) => {
                void handleSessionRequest(connector, eventError, payload).catch(
                    onFailure,
                )
            },
        )

        connector.on(
            'algo_signTxn',
            (eventError: Nullable<Error>, payload: unknown) => {
                void handleSignTxn(connector, eventError, payload).catch(
                    onFailure,
                )
            },
        )

        connector.on(
            'algo_signData',
            (eventError: Nullable<Error>, payload: unknown) => {
                void handleSignData(connector, eventError, payload).catch(
                    onFailure,
                )
            },
        )

        connector.on('disconnect', () => {
            void handlePeerDisconnect(connector.clientId).catch(onFailure)
        })

        connector.on(
            'error',
            (eventError: Nullable<Error>, payload: unknown) => {
                // The SDK delivers internal events as callback(null, event);
                // only JSON-RPC error responses populate the first argument.
                if (eventError) {
                    reportError(eventError, scopeFor(connector))
                    return
                }
                const detail = readErrorDetail(payload)
                if (!detail) {
                    logger.warn('[WC v1] transport-level error event', {
                        clientId: connector.clientId,
                    })
                    return
                }
                reportError(new WalletConnectError(detail), scopeFor(connector))
            },
        )

        // One flap is routine (the transport retries itself); a repeat before
        // any session exists means the handshake cannot complete.
        let transportErrorCount = 0
        connector.on('transport_error', () => {
            if (connector.connected) {
                // A live session's flap belongs to the reconnect sweep, never to error UI.
                return
            }
            transportErrorCount += 1
            if (transportErrorCount < 2) return
            reportError(
                new WalletConnectBridgeConnectionError(),
                pairingScope(connector.clientId),
            )
        })
    }

    const asStatus = async (
        connection: WalletConnectV1Connection,
        status: WalletConnectV1Connection['status'],
    ): Promise<WalletConnectV1Connection> => {
        if (connection.status === status) return connection
        const updated: WalletConnectV1Connection = { ...connection, status }
        await store().upsert(updated)
        return updated
    }

    // After a provider remount a surviving connector still holds the previous
    // handler instance's closures (context null), so it is rebound, not rebuilt.
    // Synchronous on purpose: `revive` relies on no yield between this check
    // and `registerConnector`.
    const rebindLive = (id: ConnectionId): boolean => {
        const live = getConnector(id)
        if (!live) return false
        bindHandlers(live)
        return true
    }

    const revive = async (
        connection: WalletConnectV1Connection,
    ): Promise<WalletConnectV1Connection> => {
        if (rebindLive(connection.id)) return asStatus(connection, 'active')

        const key = await withSessionKey(
            connection.id,
            sessionKey => sessionKey,
        )

        // Re-checked after the await, or two overlapping restores build two sockets.
        if (rebindLive(connection.id)) return asStatus(connection, 'active')

        if (key === null) {
            // Without the key the socket cannot be rebuilt; reported inactive
            // rather than dropped so the dApp does not vanish from settings.
            logger.warn(
                '[WC v1] no stored session key — the session cannot be revived',
                { connectionId: connection.id },
            )
            return asStatus(connection, 'inactive')
        }

        const session: IWalletConnectSession = {
            connected: true,
            accounts: connection.accounts,
            chainId: connection.metadata.chainId,
            bridge: connection.metadata.bridge,
            key,
            clientId: connection.id,
            clientMeta: PERA_CLIENT_META,
            peerId: connection.metadata.peerId,
            peerMeta: toClientMeta(connection.peer),
            handshakeId: connection.metadata.handshakeId ?? 0,
            handshakeTopic: connection.metadata.handshakeTopic,
        }

        try {
            const connector = createWalletConnectConnector({ session })
            bindHandlers(connector)
            registerConnector(connection.id, connector)
        } catch (error) {
            // The v1 constructor throws synchronously on a malformed bridge.
            reportError(
                new WalletConnectBridgeConnectionError(
                    'Failed to re-establish a stored WalletConnect session',
                    error instanceof Error ? error : undefined,
                ),
                connectionScope(connection.id),
            )
            return asStatus(connection, 'inactive')
        }
        return asStatus(connection, 'active')
    }

    const restore = async (): Promise<WalletConnectV1Connection[]> => {
        const own: WalletConnectV1Connection[] = []
        for (const record of await store().list()) {
            if (isWalletConnectV1Connection(record)) {
                own.push(record)
            } else if (record.kind === WALLET_CONNECT_V1_KIND) {
                // Omitting it from the reported set is what deletes it; leave a trace.
                logger.warn(
                    '[WC v1] dropping a malformed stored session record',
                    { connectionId: record.id },
                )
            }
        }
        const restored: WalletConnectV1Connection[] = []
        for (const connection of own) {
            restored.push(await revive(connection))
        }
        return restored
    }

    const disconnect = async (id: ConnectionId): Promise<void> => {
        const connector = getConnector(id)
        if (connector?.connected) {
            try {
                await connector.killSession({ message: 'User disconnected' })
            } catch (error) {
                // Local cleanup must happen even when the peer is unreachable.
                logger.warn('[WC v1] killSession failed', {
                    connectionId: id,
                    error,
                })
            }
        }
        await forgetSession(id)
        await store().remove(id)
    }

    return {
        kind: WALLET_CONNECT_V1_KIND,

        canHandleUri: isV1PairingUri,

        describeUri: uri => walletConnectLogContext(uri),

        initialize: async next => {
            context = next
            // The handler outlives every connector, so it owns re-binding after a socket recovery.
            setConnectorHandlerBinder(bindHandlers)
            // The sweep reads the connector registry when a trigger fires, so
            // it is safe before `restore()`; replaced, never stacked.
            stopSweep?.()
            stopSweep = startReconnectSweep()
        },

        // Leaves live sockets alone: teardown is a provider remount, not a user
        // disconnect. `disconnectAll` is the explicit kill.
        teardown: async () => {
            stopSweep?.()
            stopSweep = null
            pendingOrigins.clear()
            clearConnectorHandlerBinder(bindHandlers)
            context = null
        },

        pair: async (uri, opts) => {
            if (!isV1PairingUri(uri)) {
                logger.warn('[WC v1] refused a URI this handler cannot pair', {
                    ...walletConnectLogContext(uri),
                    uri: redactWalletConnectUri(uri),
                })
                throw new WalletConnectError(
                    'Not a WalletConnect v1 pairing URI',
                )
            }
            // The shared factory keeps the SDK from adopting its own localStorage session.
            const connector = createWalletConnectConnector({ uri })
            bindHandlers(connector)
            registerConnector(connector.clientId, connector)
            if (opts?.origin)
                pendingOrigins.set(connector.clientId, opts.origin)
            // One connector per pairing: the clientId is the pairing id and the eventual `Connection.id`.
            return connector.clientId
        },

        abandonPairing: pairingId => {
            pendingOrigins.delete(pairingId)
            abandonConnectorPairing(pairingId)
        },

        disconnect,

        disconnectAll: async () => {
            const own = (await store().list()).filter(
                isWalletConnectV1Connection,
            )
            // allSettled: one unreachable peer must not abort the sweep.
            await Promise.allSettled(own.map(({ id }) => disconnect(id)))
        },

        restore,

        // Narrowed first: a malformed own-kind record must not throw here.
        matchesNetwork: (connection, network) =>
            isWalletConnectV1Connection(connection) &&
            isChainIdAcceptable(connection.metadata.chainId, network),
    }
}
