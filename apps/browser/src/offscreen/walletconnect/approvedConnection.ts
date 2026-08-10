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

import type { WalletConnectConnection } from '@perawallet/wallet-core-walletconnect'
import type { HeadlessWcConnector } from './bindHeadlessHandlers'

/**
 * Builds the record persisted to the WC store once a handshake is
 * approved. Mirrors `useWalletConnect.approveSession`'s
 * `replacementSession` construction: persist only clean metadata.
 * Spreading `connector` itself would copy its live
 * `_socket`/`_transport`/`_eventManager` handles into the zustand
 * store — polluting the state tree with socket handles that
 * re-render every subscriber on each reconnect cycle. The live
 * connector itself stays in the module-level registry, queryable via
 * `getConnector(clientId)`.
 *
 * Pure by construction — `existing` (the previously persisted record for
 * this `clientId`, if any) is passed in rather than looked up here, so this
 * has no dependency on the store's record shape or a `storedConnections()`
 * accessor. That's what makes it unit-testable without a fake socket or a
 * fake store: a real `WalletConnectConnection` in, a real one out.
 */
export const buildApprovedConnection = (
    connector: HeadlessWcConnector,
    permissions: string[],
    existing: WalletConnectConnection | undefined,
): WalletConnectConnection => {
    return {
        clientId: connector.clientId,
        version: connector.version,
        bridge: connector.bridge,
        connected: connector.connected,
        session: {
            ...(connector.session as Record<string, unknown> | undefined),
            permissions,
            clientId: connector.clientId,
            // `connector.session` is `unknown` here — see
            // `HeadlessWcConnector`'s doc comment for why this file can't
            // name the real WC session type — so the merged literal is
            // cast back to the store's shape at this boundary rather than
            // the connector's whole type.
        } as WalletConnectConnection['session'],
        createdAt: existing?.createdAt ?? new Date(),
        lastActiveAt: new Date(),
    }
}
