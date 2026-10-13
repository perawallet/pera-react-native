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
    ConnectionsError,
    type ConnectionErrorScope,
    type ConnectionHandler,
    type ConnectionProposal,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import {
    AppError,
    ErrorCategory,
    logger,
    Networks,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { ConnectionKind } from '@perawallet/wallet-extension-connections'

import { onConnectionsEvent, sendConnectionsControlMessage } from './client'
import type { ConnectionsEvent } from './protocol'

type ProposalListener = (proposal: ConnectionProposal) => void
type ErrorListener = (error: Error, scope?: ConnectionErrorScope) => void

// Only an `AppError` reaches `resolveErrorCopy`'s translated branch, so a
// broadcast error that carried a key is rebuilt as one.
const rebuildError = (
    event: Extract<ConnectionsEvent, { kind: 'error' }>,
): Error => {
    const error = event.messageKey
        ? new AppError(event.message, {
              category: ErrorCategory.CONNECTIONS,
              messageKey: event.messageKey,
          })
        : new Error(event.message)
    error.name = event.name
    return error
}

/**
 * URI claims, `describeUri`, `networksFor` and `methodsFor` are answered locally from
 * un-initialized handler instances; every lifecycle call goes to the offscreen
 * document, which owns the live handlers. No host surface by type: inbound
 * requests route offscreen → service worker → approval window, never to a UI realm.
 */
export const createRemoteConnectionRegistry = (options: {
    handlers: ConnectionHandler[]
}): ConnectionRegistryClient => {
    const handlers = new Map<ConnectionKind, ConnectionHandler>(
        options.handlers.map(handler => [handler.kind, handler]),
    )
    const proposalListeners = new Set<ProposalListener>()
    const errorListeners = new Set<ErrorListener>()
    let unsubscribeEvents: Nullable<() => void> = null

    const claimingHandler = (uri: string): Nullable<ConnectionHandler> =>
        [...handlers.values()].find(h => h.canHandleUri?.(uri)) ?? null

    const toProposal = (
        summary: Extract<ConnectionsEvent, { kind: 'proposal' }>['proposal'],
    ): ConnectionProposal => ({
        ...summary,
        approve: async accounts => {
            const { connection } = await sendConnectionsControlMessage({
                kind: 'approve-proposal',
                proposalId: summary.proposalId,
                accounts,
            })
            return connection
        },
        reject: async reason => {
            await sendConnectionsControlMessage({
                kind: 'reject-proposal',
                proposalId: summary.proposalId,
                reason,
            })
        },
    })

    // A throwing subscriber must not abort the fan-out to the others.
    const handleEvent = (event: ConnectionsEvent): void => {
        if (event.kind === 'proposal') {
            const proposal = toProposal(event.proposal)
            for (const listener of proposalListeners) {
                try {
                    listener(proposal)
                } catch (listenerError) {
                    logger.warn('[connections] proposal listener threw', {
                        error: listenerError,
                    })
                }
            }
            return
        }
        const error = rebuildError(event)
        for (const listener of errorListeners) {
            try {
                listener(error, event.scope)
            } catch (listenerError) {
                logger.warn('[connections] error listener threw', {
                    error: listenerError,
                })
            }
        }
    }

    // One chrome listener for both channels, held only while someone is
    // subscribed.
    const syncEventSubscription = (): void => {
        const wanted = proposalListeners.size + errorListeners.size > 0
        if (wanted && !unsubscribeEvents) {
            unsubscribeEvents = onConnectionsEvent(handleEvent)
        } else if (!wanted && unsubscribeEvents) {
            unsubscribeEvents()
            unsubscribeEvents = null
        }
    }

    const subscribe = <T>(set: Set<T>, listener: T): (() => void) => {
        set.add(listener)
        syncEventSubscription()
        return () => {
            set.delete(listener)
            syncEventSubscription()
        }
    }

    return {
        pair: async (uri, opts) => {
            const handler = claimingHandler(uri)
            if (!handler?.pair) {
                throw new ConnectionsError(
                    'no-handler',
                    'No connection handler accepts this URI',
                )
            }
            const { pairingId } = await sendConnectionsControlMessage({
                kind: 'pair',
                uri,
                origin: opts?.origin,
            })
            return pairingId
        },
        abandonPairing: pairingId => {
            void sendConnectionsControlMessage({
                kind: 'abandon-pairing',
                pairingId,
            }).catch((error: unknown) => {
                logger.warn('[connections] abandon-pairing failed', {
                    pairingId,
                    error,
                })
            })
        },
        describeUri: uri => claimingHandler(uri)?.describeUri?.(uri) ?? {},
        networksFor: connection => {
            const handler = handlers.get(connection.kind)
            if (!handler) return []
            return Object.values(Networks).filter(network =>
                handler.matchesNetwork(connection, network),
            )
        },
        methodsFor: connection =>
            handlers.get(connection.kind)?.methodsFor(connection) ?? [],
        disconnect: async id => {
            await sendConnectionsControlMessage({
                kind: 'disconnect',
                connectionId: id,
            })
        },
        disconnectAll: async () => {
            await sendConnectionsControlMessage({ kind: 'disconnect-all' })
        },
        subscribeToProposals: listener =>
            subscribe(proposalListeners, listener),
        subscribeToErrors: listener => subscribe(errorListeners, listener),
    }
}
