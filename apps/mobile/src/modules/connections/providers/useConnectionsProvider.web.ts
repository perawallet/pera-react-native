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

import { useEffect, useRef } from 'react'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import {
    hydrateConnectionsStore,
    setActiveConnectionRegistry,
    useConnectionsStore,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
// lanekeep-ignore-next-line pera/no-wc-imports-in-connections-module reason: the web composition root names the handler so the remote registry can answer URI claims locally
import { createWalletConnectV1Handler } from '@perawallet/wallet-core-walletconnect'
import { CONNECTIONS_STORAGE_KEY } from '@perawallet/wallet-extension-connections'
import { onLocalStorageKeyChanged } from '@perawallet/wallet-extension-platform-chrome'
import { createRemoteConnectionRegistry } from '@perawallet/wallet-extension-platform-chrome/remote-registry'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useConnectionErrorToasts } from './useConnectionErrorToasts'
import type { ProposalQueueHandle } from './useProposalQueue'

// Proposals open the approval window, so a UI realm has no sheet to close.
const noSheet: ProposalQueueHandle = {
    closeForScope: () => {},
    isRejectingOnError: () => false,
}

// `ChromeKeyValueStorageService` namespaces its keys under `kv:`; the same
// literal `runOffscreenApp.ts` hardcodes for its own stores.
const CONNECTIONS_KV_KEY = `kv:${CONNECTIONS_STORAGE_KEY}`

// The handler is never initialized here; it only answers `canHandleUri`/`describeUri`.
export const useConnectionsProvider = (): ConnectionRegistryClient => {
    const registryRef = useRef<ConnectionRegistryClient | null>(null)
    if (!registryRef.current) {
        registryRef.current = createRemoteConnectionRegistry({
            handlers: [
                createWalletConnectV1Handler({
                    getNetwork: () => useNetworkStore.getState().network,
                }),
            ],
        })
    }
    const registry = registryRef.current

    useEffect(() => {
        setActiveConnectionRegistry(registry)
        return () => setActiveConnectionRegistry(null)
    }, [registry])

    useEffect(() => {
        const store = getProvider().connections.store
        const stopHydration = hydrateConnectionsStore(store)
        // The store only notifies its own realm's writers; the offscreen
        // host's writes arrive as chrome.storage changes.
        const stopWatching = onLocalStorageKeyChanged(
            [CONNECTIONS_KV_KEY],
            () => {
                void store
                    .list()
                    .then(useConnectionsStore.getState().setConnections)
            },
        )
        return () => {
            stopHydration()
            stopWatching()
        }
    }, [])

    useConnectionErrorToasts(registry, noSheet)

    return registry
}
