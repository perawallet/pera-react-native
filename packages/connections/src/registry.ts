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
    logger,
    Networks,
    toError,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionId,
    ConnectionKind,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import { ConnectionsError } from './errors'
import type { ConnectionHandler, ConnectionHandlerContext } from './handler'
import type {
    ConnectionErrorScope,
    ConnectionPairOptions,
    ConnectionProposal,
    InboundMessage,
    RawInboundMessage,
} from './models'
import { validateRawMessage } from './validate'

/**
 * The UI-side surface. {@link ConnectionRegistry}'s host methods belong only to
 * the composition root; browser-extension UI realms get a remote client.
 */
export interface ConnectionRegistryClient {
    /** Routed to the handler whose `canHandleUri` claims the URI; throws `'no-handler'` when none does. */
    pair(uri: string, opts?: ConnectionPairOptions): Promise<string>
    /** No-op for an id this registry never issued or a handler without `abandonPairing`. */
    abandonPairing(pairingId: string): void
    /** Empty when nothing claims the URI. Never contains the URI itself. */
    describeUri(uri: string): Record<string, string | null>
    /** Empty for a kind with no registered handler. */
    networksFor(connection: Connection): Network[]
    disconnect(id: ConnectionId): Promise<void>
    disconnectAll(): Promise<void>
    subscribeToProposals(listener: (p: ConnectionProposal) => void): () => void
    subscribeToErrors(
        listener: (error: Error, scope?: ConnectionErrorScope) => void,
    ): () => void
}

export interface ConnectionRegistry extends ConnectionRegistryClient {
    /** Throws while live (from `initialize()` until the next `teardown()` settles) or for a kind already held. */
    register(handler: ConnectionHandler): void
    /**
     * Store reconciliation completes before this resolves. Idempotent (a
     * concurrent call shares the in-flight run) and serialised with `teardown()`;
     * one handler failing is reported on the error channel and never blocks the others.
     */
    initialize(): Promise<void>
    teardown(): Promise<void>
    subscribeToMessages(listener: (m: InboundMessage) => void): () => void
}

export const createConnectionRegistry = (options: {
    store: ConnectionStoreAPI
}): ConnectionRegistry => {
    const { store } = options
    const handlers = new Map<ConnectionKind, ConnectionHandler>()
    // Which handler issued each pairing id, so `abandonPairing` can route
    // without the id carrying its protocol.
    const pairings = new Map<string, ConnectionHandler>()
    const proposalListeners = new Set<(p: ConnectionProposal) => void>()
    const messageListeners = new Set<(m: InboundMessage) => void>()
    const errorListeners = new Set<
        (e: Error, scope?: ConnectionErrorScope) => void
    >()
    // Whole lifecycle promises, so the two chain rather than overlap. `isLive`
    // outlasts `initializing`: a handler registered after it clears but before
    // teardown settles would otherwise be torn down without ever initialising.
    let initializing: Nullable<Promise<void>> = null
    let tearingDown: Nullable<Promise<void>> = null
    let isLive = false

    // A throwing subscriber must not abort the fan-out or propagate into the
    // handler's relay/socket callback.
    const emitError = (error: Error, scope?: ConnectionErrorScope): void => {
        for (const listener of errorListeners) {
            try {
                listener(error, scope)
            } catch (listenerError) {
                logger.warn('[connections] error listener threw', {
                    error: listenerError,
                })
            }
        }
    }

    // `reject` may reject or throw synchronously; either escaping would blow
    // out of the handler's own relay/socket listener.
    const rejectToPeer = (raw: RawInboundMessage, error: Error): void => {
        if (raw.kind !== 'request') return
        try {
            raw.reject(error).catch((deliveryError: unknown) => {
                logger.warn('[connections] reject delivery failed', {
                    error: deliveryError,
                })
            })
        } catch (syncError) {
            logger.warn('[connections] reject threw synchronously', {
                error: syncError,
            })
        }
    }

    const contextFor = (): ConnectionHandlerContext => ({
        store,
        onProposal: proposal => {
            for (const listener of proposalListeners) {
                try {
                    listener(proposal)
                } catch (listenerError) {
                    logger.warn('[connections] proposal listener threw', {
                        error: listenerError,
                    })
                }
            }
        },
        onMessage: (raw: RawInboundMessage) => {
            // Validation lives here so no subscriber sees an unvalidated payload;
            // a parse failure is answered so the peer gets an error, not a timeout.
            const validated = validateRawMessage(raw)
            if (!validated.ok) {
                rejectToPeer(raw, validated.error)
                emitError(validated.error, { connectionId: raw.connectionId })
                return
            }
            if (messageListeners.size === 0 && raw.kind === 'request') {
                // Nobody will ever answer, so the peer would only time out.
                const unhandled = new ConnectionsError(
                    'no-subscriber',
                    'No message subscriber is mounted to answer this request',
                )
                rejectToPeer(raw, unhandled)
                emitError(unhandled, { connectionId: raw.connectionId })
                return
            }
            for (const listener of messageListeners) {
                try {
                    listener(validated.message)
                } catch (listenerError) {
                    logger.warn('[connections] message listener threw', {
                        error: listenerError,
                    })
                }
            }
        },
        onDisconnected: id => {
            store.remove(id).catch((error: unknown) => {
                const normalized = toError(error)
                logger.warn(
                    '[connections] store.remove failed after disconnect',
                    { id, error: normalized },
                )
                emitError(normalized, { connectionId: id })
            })
        },
        onError: emitError,
    })

    // A throwing `canHandleUri` propagates on purpose: a claim predicate is
    // pure, and swallowing would hide a handler bug behind 'no-handler'.
    const claimingHandler = (uri: string): Nullable<ConnectionHandler> =>
        [...handlers.values()].find(h => h.canHandleUri?.(uri)) ?? null

    const handlerForConnection = async (
        id: ConnectionId,
    ): Promise<ConnectionHandler> => {
        const connection = await store.get(id)
        if (!connection) {
            throw new ConnectionsError(
                'unknown-connection',
                `No connection ${id}`,
            )
        }
        const handler = handlers.get(connection.kind)
        if (!handler) {
            throw new ConnectionsError(
                'no-handler',
                `No connection handler registered for kind ${connection.kind}`,
            )
        }
        return handler
    }

    // Per kind, so a handler's `restore()` can neither remove nor write
    // records of another kind.
    const reconcile = async (
        kind: ConnectionKind,
        reported: Connection[],
    ): Promise<void> => {
        const live = reported.filter(connection => connection.kind === kind)
        if (live.length !== reported.length) {
            logger.warn('[connections] handler reported foreign-kind records', {
                kind,
                dropped: reported.length - live.length,
            })
        }
        const liveIds = new Set(live.map(connection => connection.id))
        for (const record of await store.list()) {
            if (record.kind === kind && !liveIds.has(record.id)) {
                await store.remove(record.id)
            }
        }
        for (const connection of live) {
            await store.upsert(connection)
        }
    }

    const bootHandler = async (handler: ConnectionHandler): Promise<void> => {
        try {
            await handler.initialize(contextFor())
            await reconcile(handler.kind, await handler.restore())
        } catch (error) {
            const normalized = toError(error)
            logger.error('[connections] handler boot failed', {
                kind: handler.kind,
                error: normalized,
            })
            emitError(normalized)
        }
    }

    const runInitialize = async (): Promise<void> => {
        await Promise.all([...handlers.values()].map(bootHandler))
    }

    const runTeardown = async (): Promise<void> => {
        await Promise.allSettled([...handlers.values()].map(h => h.teardown()))
    }

    return {
        register: handler => {
            if (isLive) {
                throw new ConnectionsError(
                    'already-initialized',
                    `Cannot register ${handler.kind} after initialize()`,
                )
            }
            if (handlers.has(handler.kind)) {
                throw new ConnectionsError(
                    'duplicate-kind',
                    `A handler for ${handler.kind} is already registered`,
                )
            }
            handlers.set(handler.kind, handler)
        },
        initialize: () => {
            if (initializing) return initializing
            isLive = true
            initializing = (tearingDown ?? Promise.resolve()).then(
                runInitialize,
            )
            return initializing
        },
        teardown: () => {
            if (!initializing && tearingDown) return tearingDown
            const settled = initializing ?? Promise.resolve()
            initializing = null
            const mine: Promise<void> = settled
                .then(runTeardown)
                .finally(() => {
                    // Only the current teardown may go quiet, and only with no
                    // initialize() queued: an older one settling would read a
                    // newer teardown's cleared `initializing`.
                    if (tearingDown === mine && initializing === null) {
                        isLive = false
                    }
                })
            tearingDown = mine
            return tearingDown
        },
        pair: async (uri, opts) => {
            const handler = claimingHandler(uri)
            if (!handler?.pair) {
                throw new ConnectionsError(
                    'no-handler',
                    'No connection handler accepts this URI',
                )
            }
            const pairingId = await handler.pair(uri, opts)
            pairings.set(pairingId, handler)
            return pairingId
        },
        abandonPairing: pairingId => {
            const handler = pairings.get(pairingId)
            pairings.delete(pairingId)
            handler?.abandonPairing?.(pairingId)
        },
        describeUri: uri => claimingHandler(uri)?.describeUri?.(uri) ?? {},
        networksFor: connection => {
            const handler = handlers.get(connection.kind)
            if (!handler) return []
            return Object.values(Networks).filter(network =>
                handler.matchesNetwork(connection, network),
            )
        },
        disconnect: async id => {
            const handler = await handlerForConnection(id)
            await handler.disconnect(id)
        },
        disconnectAll: async () => {
            // allSettled: one unreachable peer must not abort the sweep.
            await Promise.allSettled(
                [...handlers.values()].map(h => h.disconnectAll()),
            )
        },
        subscribeToProposals: listener => {
            proposalListeners.add(listener)
            return () => void proposalListeners.delete(listener)
        },
        subscribeToMessages: listener => {
            messageListeners.add(listener)
            return () => void messageListeners.delete(listener)
        },
        subscribeToErrors: listener => {
            errorListeners.add(listener)
            return () => void errorListeners.delete(listener)
        },
    }
}
