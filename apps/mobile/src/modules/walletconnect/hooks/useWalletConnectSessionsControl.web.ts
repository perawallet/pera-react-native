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

import { useCallback } from 'react'
import {
    useWalletConnectStore,
    type WalletConnectConnection,
} from '@perawallet/wallet-core-walletconnect'
import { sendWcControlMessage } from '@perawallet/wallet-extension-platform-chrome'
import type { UseWalletConnectSessionsControlResult } from './useWalletConnectSessionsControl'

/**
 * Web twin. Offscreen — not this UI surface — is the sole owner of WC
 * connectors on web (see `wcHost.ts`); merely calling `useWalletConnect`
 * here would register a second connector handler binder and race offscreen
 * to answer the same dApp request. `connections` reads the shared,
 * storage-synced store directly (`walletConnectConnections` is the only
 * slice of `useWalletConnectStore` persisted via `partialize`, so it stays
 * in sync with offscreen's own writes across the extension's contexts).
 *
 * `disconnect`/`deleteAllSessions` send `disconnect` control messages to the
 * offscreen host instead of calling a (nonexistent, in this realm)
 * connector's `killSession` directly — closing the bug where a web revoke
 * dropped the local store row without ever telling the dApp or closing
 * offscreen's socket.
 *
 * Once the control message is sent, `disconnect` also filters the local
 * store — mirroring native's `disconnect`, which kills the session and
 * *then* unconditionally drops the row via `setConnections(connections.
 * filter(...))`. Without this, the row would stay on screen until this
 * realm's own copy re-hydrates from offscreen's write: offscreen's removal
 * writes through `chrome.storage` (via zustand `persist`), and every UI
 * realm — not just offscreen — now re-reads that write via
 * `registerWcStoreRehydration()` (`AppShell.web.tsx`, backed by the same
 * `onLocalStorageKeyChanged` accessor `runOffscreenApp.ts` uses for its own
 * stores), but that re-hydrate is async; filtering here as well keeps this
 * realm's own optimistic view in sync without waiting on it. Reading
 * `useWalletConnectStore.getState()`
 * fresh at write time (instead of closing over the `connections` this hook
 * rendered with) keeps `deleteAllSessions`'s concurrent `disconnect` calls
 * from clobbering each other's filter — the same reason `removeConnection`
 * in `runOffscreenApp.ts` reads `getState()` right before its own filter.
 */
export const useWalletConnectSessionsControl =
    (): UseWalletConnectSessionsControlResult => {
        const connections = useWalletConnectStore(
            state => state.walletConnectConnections,
        )

        const disconnect = useCallback(
            async (clientId: string): Promise<void> => {
                await sendWcControlMessage({ kind: 'disconnect', clientId })
                const {
                    walletConnectConnections,
                    setWalletConnectConnections,
                } = useWalletConnectStore.getState()
                setWalletConnectConnections(
                    walletConnectConnections.filter(
                        connection => connection.clientId !== clientId,
                    ),
                )
            },
            [],
        )

        const deleteAllSessions = useCallback(async (): Promise<void> => {
            await Promise.all(
                connections
                    .filter(
                        (
                            connection,
                        ): connection is WalletConnectConnection & {
                            clientId: string
                        } => !!connection.clientId,
                    )
                    .map(connection => disconnect(connection.clientId)),
            )
            // Mirrors native's `useWalletConnect.deleteAllSessions`, which
            // ends with an unconditional `setConnections([])` — wiping the
            // list including any `clientId`-less row `disconnect` above
            // could never target. Without this, such a row would survive
            // "delete all" and be permanently undeletable (the exact shape
            // of the bug I-1 fixed for a single revoke). Safe to run after
            // every disconnect control message has already been sent above.
            useWalletConnectStore.getState().setWalletConnectConnections([])
        }, [connections, disconnect])

        return { connections, disconnect, deleteAllSessions }
    }
