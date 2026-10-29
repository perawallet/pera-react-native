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
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    hydrateConnectionsStore,
    setActiveConnectionRegistry,
    useConnectionsStore,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import {
    createEip1193ConnectionHandler,
    createNoopDappTransport,
} from '@perawallet/wallet-core-dapp'
import { CONNECTIONS_STORAGE_KEY } from '@perawallet/wallet-extension-connections'
import { onLocalStorageKeyChanged } from '@perawallet/wallet-core-browser-runtime'
import { createRemoteConnectionRegistry } from '@perawallet/wallet-core-browser-runtime/remote-registry'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { createAlgorandDescriptorHandlers } from '@modules/algorand/web'
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

const getNetworkId = (chainId: ChainId) => getSelectedScope(chainId).networkId

// Handlers are never initialized here; they only answer descriptor queries
// (`canHandleUri`/`describeUri` for v1, `methodsFor`/`matchesChainScope` for
// the injected providers).
export const useConnectionsProvider = (): ConnectionRegistryClient => {
    const registryRef = useRef<Nullable<ConnectionRegistryClient>>(null)
    if (!registryRef.current) {
        registryRef.current = createRemoteConnectionRegistry({
            handlers: [
                ...createAlgorandDescriptorHandlers({ getNetworkId }),
                createEip1193ConnectionHandler({
                    transport: createNoopDappTransport(),
                    getNetworkId,
                    isDappConnectEnabled: () => false,
                    getAccounts: () => [],
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
