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
    useWalletConnect,
    type WalletConnectConnection,
} from '@perawallet/wallet-core-walletconnect'
import { useNetwork } from '@perawallet/wallet-core-blockchain'

export type UseWalletConnectSessionsControlResult = {
    connections: WalletConnectConnection[]
    disconnect: (clientId: string) => Promise<void>
    deleteAllSessions: () => Promise<void>
}

/**
 * Thin native wrapper around `useWalletConnect(network)`'s session-list /
 * disconnect surface. Exists so the settings screens and the "delete all
 * data" flow — which only ever read the session list or disconnect one/all
 * of them, never bind connector event handlers — can share a single import
 * with their web twin (`useWalletConnectSessionsControl.web.ts`), which
 * reads the list off the store and routes disconnects through the
 * offscreen host instead of a UI-owned connector.
 *
 * `useWalletConnect.disconnect` also takes a `triggerDisconnect` flag
 * (`false` means "drop locally, don't notify the dApp"), but every one of
 * the four call sites this hook serves always passes `true` — there is no
 * live caller of `false` anywhere in the app. Rather than carry a dead
 * parameter across the shared twin boundary (where it would be silently
 * unenforceable — a narrower function type is assignable to a wider one,
 * so a web implementation that ignored it would type-check with no error),
 * it's hardcoded here to `true`. If a real caller ever needs `false`, add
 * it back to `UseWalletConnectSessionsControlResult` and thread it through
 * both halves deliberately, rather than resurrecting an unused knob.
 *
 * `disconnect` is wrapped in `useCallback` — `useWalletConnect(network).
 * disconnect` is itself stable across renders, and a fresh arrow here on
 * every render would defeat any `useMemo`/`useCallback` downstream that
 * lists it as a dependency (e.g. `useConnectionsSettingsScreen`'s unified,
 * sorted connection list), forcing an unnecessary rebuild every render even
 * though nothing it depends on changed.
 */
export const useWalletConnectSessionsControl =
    (): UseWalletConnectSessionsControlResult => {
        const { network } = useNetwork()
        const { connections, disconnect, deleteAllSessions } =
            useWalletConnect(network)
        const disconnectAndNotifyPeer = useCallback(
            (clientId: string) => disconnect(clientId, true),
            [disconnect],
        )
        return {
            connections,
            disconnect: disconnectAndNotifyPeer,
            deleteAllSessions,
        }
    }
