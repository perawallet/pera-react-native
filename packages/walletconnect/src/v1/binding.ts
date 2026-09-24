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
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import type { ConnectionId } from '@perawallet/wallet-extension-connections'
import {
    pairingScope,
    type HandlerKit,
} from '@perawallet/wallet-core-connections/handlerKit'
import {
    BOUND_EVENTS,
    type WalletConnectConnectorRegistry,
} from '../connection'
import {
    WalletConnectBridgeConnectionError,
    WalletConnectError,
} from '../shared/errors'
import type { V1ConnectorEventHandler } from './requests'
import { scopeFor } from './scope'
import type { WalletConnectV1SessionKeyStore } from './secrets'
import { readErrorDetail } from './wire'

export type V1ConnectorBinding = {
    bindHandlers: (connector: WalletConnect) => void
    /** Local cleanup for a session that has ended, from either side. */
    forgetSession: (id: ConnectionId) => Promise<void>
}

export const createV1ConnectorBinding = (deps: {
    kit: HandlerKit
    connectors: Pick<WalletConnectConnectorRegistry, 'forget'>
    sessionKeys: WalletConnectV1SessionKeyStore
    handleSessionRequest: V1ConnectorEventHandler
    handleSignTxn: V1ConnectorEventHandler
    handleSignData: V1ConnectorEventHandler
}): V1ConnectorBinding => {
    const {
        kit,
        connectors,
        sessionKeys,
        handleSessionRequest,
        handleSignTxn,
        handleSignData,
    } = deps
    const { reportError } = kit

    // The SDK invokes listeners with nowhere to put a rejected promise; unhandled,
    // it escapes to the platform's global handler.
    const onListenerFailure =
        (connector: WalletConnect) =>
        (listenerError: unknown): void => {
            reportError(listenerError, scopeFor(connector))
        }

    const forgetSession = async (id: ConnectionId): Promise<void> => {
        // Tombstoned so an in-flight socket recovery aborts instead of resurrecting the peer.
        connectors.forget(id)
        await sessionKeys.remove(id).catch((secretError: unknown) => {
            logger.warn('[WC v1] failed to remove a stored session key', {
                connectionId: id,
                error: secretError,
            })
        })
    }

    const handlePeerDisconnect = async (id: ConnectionId): Promise<void> => {
        await forgetSession(id)
        // The registry removes the record, whichever side ended the session.
        kit.currentContext()?.onDisconnected(id)
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

    return { bindHandlers, forgetSession }
}
