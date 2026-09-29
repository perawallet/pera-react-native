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
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { ConnectionId } from '@perawallet/wallet-extension-connections'
import { createHandlerKit } from '@perawallet/wallet-core-connections/handlerKit'
import {
    createConnectorRegistry,
    createWalletConnectConnector,
} from '../connection'
import { isChainIdAcceptable } from '../shared/chain'
import { redactWalletConnectUri, walletConnectLogContext } from '../shared/uri'
import { WalletConnectError } from '../shared/errors'
import { createV1ConnectorBinding } from './binding'
import {
    bridgeUrlFromV1Uri,
    isSecureBridgeUrl,
    isV1PairingUri,
    isWalletConnectV1Connection,
    WALLET_CONNECT_V1_KIND,
    type WalletConnectV1Handler,
} from './connection'
import { createV1ProposalHandlers } from './proposals'
import { createV1RequestHandlers } from './requests'
import { createV1SessionRestorer } from './restore'
import {
    createKeystoreSessionKeyStore,
    type WalletConnectV1SessionKeyStore,
} from './secrets'
import { startReconnectSweep } from './reconnectSweep'
import { createWalletConnectV1Delivery } from './deliver'

export type CreateWalletConnectV1HandlerOptions = {
    /**
     * Injected rather than read from a store: a store default would drag the
     * blockchain package into every importer's module graph, `apps/browser` included.
     */
    getNetwork: () => Network
    /** Defaults to the keystore; the extension's offscreen document has none. */
    sessionKeys?: WalletConnectV1SessionKeyStore
}

// v1 is one bridge WebSocket per session, so this handler owns N connectors rather than one relay.
export const createWalletConnectV1Handler = (
    options: CreateWalletConnectV1HandlerOptions,
): WalletConnectV1Handler => {
    const { getNetwork } = options
    const sessionKeys = options.sessionKeys ?? createKeystoreSessionKeyStore()

    // Pending origins are keyed by clientId: on v1 the connector IS the pairing.
    const kit = createHandlerKit(WALLET_CONNECT_V1_KIND, {
        logTag: '[WC v1]',
        notInitializedError: () =>
            new WalletConnectError(
                'The WalletConnect v1 handler was used before initialize()',
            ),
        activityLogFields: id => ({ clientId: id }),
    })
    const { store } = kit
    let stopSweep: Nullable<() => void> = null
    // Instance state, not module state: a UI realm constructs this handler
    // for its descriptors alone and must never see another realm's sockets.
    // Declared before `bindHandlers` exists, so the binder is deferred.
    const connectors = createConnectorRegistry({
        bindHandlers: connector => bindHandlers(connector),
    })
    const delivery = createWalletConnectV1Delivery(connectors)

    const requests = createV1RequestHandlers({ kit, connectors, getNetwork })
    const proposals = createV1ProposalHandlers({
        kit,
        connectors,
        getNetwork,
        sessionKeys,
        connectionFor: requests.connectionFor,
    })
    const { bindHandlers, forgetSession } = createV1ConnectorBinding({
        kit,
        connectors,
        sessionKeys,
        handleSessionRequest: proposals.handleSessionRequest,
        handleSignTxn: requests.handleSignTxn,
        handleSignData: requests.handleSignData,
    })
    const { restore } = createV1SessionRestorer({
        kit,
        connectors,
        sessionKeys,
        bindHandlers,
    })

    const disconnect = async (id: ConnectionId): Promise<void> => {
        const connector = connectors.get(id)
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
            kit.attach(next)
            // The sweep reads the connector registry when a trigger fires, so
            // it is safe before `restore()`; replaced, never stacked.
            stopSweep?.()
            stopSweep = startReconnectSweep(() => connectors.reconnectAll())
        },

        // Leaves live sockets alone: teardown is a provider remount, not a user
        // disconnect. `disconnectAll` is the explicit kill.
        teardown: async () => {
            stopSweep?.()
            stopSweep = null
            proposals.clear()
            kit.detach()
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
            const bridge = bridgeUrlFromV1Uri(uri)
            if (!bridge || !isSecureBridgeUrl(bridge)) {
                logger.warn('[WC v1] refused an insecure bridge', {
                    ...walletConnectLogContext(uri),
                })
                throw new WalletConnectError(
                    'WalletConnect v1 bridge must be https or wss',
                )
            }
            // The shared factory keeps the SDK from adopting its own localStorage session.
            const connector = createWalletConnectConnector({ uri })
            bindHandlers(connector)
            connectors.register(connector.clientId, connector)
            if (opts?.origin)
                kit.pendingOrigins.remember(connector.clientId, opts.origin)
            // One connector per pairing: the clientId is the pairing id and the eventual `Connection.id`.
            return connector.clientId
        },

        abandonPairing: pairingId => {
            proposals.forgetPairing(pairingId)
            connectors.abandonPairing(pairingId)
        },

        reconnect: () => connectors.reconnectAll(),

        ...delivery,

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

        methodsFor: connection =>
            isWalletConnectV1Connection(connection)
                ? (connection.metadata.permissions ?? [])
                : [],
    }
}
