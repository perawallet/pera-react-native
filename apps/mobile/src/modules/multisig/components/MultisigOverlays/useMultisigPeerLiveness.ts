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
import { useConnectionsStore } from '@perawallet/wallet-core-connections'

/**
 * Whether a WalletConnect peer still has a session, keyed by clientId — which
 * for a v1 connection IS the connection record's id.
 *
 * Read lazily per poll (no subscription): the persisted connections are the
 * source of truth for whether a session exists, and socket state is
 * irrelevant since a reconnect keeps the record. A dead answer cancels the
 * user's sign request outright, so before the mirror has hydrated the only
 * safe answer is alive; the next poll re-decides.
 */
export const useMultisigPeerLiveness = (): ((clientId: string) => boolean) =>
    useCallback((clientId: string) => {
        const { connections, isHydrated } = useConnectionsStore.getState()
        if (!isHydrated) return true
        return connections.some(connection => connection.id === clientId)
    }, [])
