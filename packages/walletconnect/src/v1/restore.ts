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

import type { IWalletConnectSession } from '@perawallet/walletconnect'
import { logger } from '@perawallet/wallet-core-shared'
import type { ConnectionId } from '@perawallet/wallet-extension-connections'
import {
    connectionScope,
    type HandlerKit,
} from '@perawallet/wallet-core-connections/handlerKit'
import {
    createWalletConnectConnector,
    type WalletConnectConnectorRegistry,
} from '../connection'
import { PERA_CLIENT_META } from '../shared/constants'
import { WalletConnectBridgeConnectionError } from '../shared/errors'
import type { V1ConnectorBinding } from './binding'
import {
    isSecureBridgeUrl,
    isWalletConnectV1Connection,
    WALLET_CONNECT_V1_KIND,
    type WalletConnectV1Connection,
} from './connection'
import type { WalletConnectV1SessionKeyStore } from './secrets'
import { toClientMeta } from './wire'

export const createV1SessionRestorer = (deps: {
    kit: HandlerKit
    connectors: Pick<WalletConnectConnectorRegistry, 'get' | 'register'>
    sessionKeys: WalletConnectV1SessionKeyStore
    bindHandlers: V1ConnectorBinding['bindHandlers']
}): { restore: () => Promise<WalletConnectV1Connection[]> } => {
    const { kit, connectors, sessionKeys, bindHandlers } = deps
    const { reportError, store } = kit

    const asStatus = async (
        connection: WalletConnectV1Connection,
        status: WalletConnectV1Connection['status'],
    ): Promise<WalletConnectV1Connection> => {
        if (connection.status === status) return connection
        const updated: WalletConnectV1Connection = { ...connection, status }
        await store().upsert(updated)
        return updated
    }

    // Teardown leaves sockets alive, so a re-initialised handler (StrictMode, a
    // data wipe re-booting the registry) rebinds rather than rebuilds them.
    // Synchronous on purpose: `revive` relies on no yield between this check
    // and `connectors.register`.
    const rebindLive = (id: ConnectionId): boolean => {
        const live = connectors.get(id)
        if (!live) return false
        bindHandlers(live)
        return true
    }

    const revive = async (
        connection: WalletConnectV1Connection,
    ): Promise<WalletConnectV1Connection> => {
        if (rebindLive(connection.id)) return asStatus(connection, 'active')

        // Imported records (native-app migration, legacy store) never went
        // through `pair`. Inactive rather than dropped, like a constructor
        // failure below, so the dApp stays in settings.
        if (!isSecureBridgeUrl(connection.metadata.bridge)) {
            reportError(
                new WalletConnectBridgeConnectionError(
                    'Stored WalletConnect session has an unusable bridge',
                ),
                connectionScope(connection.id),
            )
            return asStatus(connection, 'inactive')
        }

        // A keystore fault or a failed decrypt is this one session's problem;
        // thrown, it would abort `restore` for every session after it.
        let key: string | null
        try {
            key = await sessionKeys.read(connection.id)
        } catch (error) {
            logger.warn('[WC v1] failed to read a stored session key', {
                connectionId: connection.id,
                error,
            })
            key = null
        }

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
            connectors.register(connection.id, connector)
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
                // Omitting it from the reported set is what deletes it, and
                // reconciliation only touches the store, so the session key it
                // points at has to be released here or it outlives the record.
                logger.warn(
                    '[WC v1] dropping a malformed stored session record',
                    { connectionId: record.id },
                )
                await sessionKeys
                    .remove(record.id)
                    .catch((secretError: unknown) => {
                        logger.warn(
                            '[WC v1] failed to remove a dropped record’s session key',
                            { connectionId: record.id, error: secretError },
                        )
                    })
            }
        }
        const restored: WalletConnectV1Connection[] = []
        for (const connection of own) {
            try {
                restored.push(await revive(connection))
            } catch (error) {
                // Reported unchanged rather than dropped: omitting it from the
                // returned set is what makes reconciliation delete the record.
                logger.warn('[WC v1] failed to restore a stored session', {
                    connectionId: connection.id,
                    error,
                })
                restored.push(connection)
            }
        }
        return restored
    }

    return { restore }
}
