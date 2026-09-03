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

import { useRef } from 'react'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import {
    createConnectionRegistry,
    useConnectionSigningAdapter,
    type ConnectionRegistry,
} from '@perawallet/wallet-core-connections'
// lanekeep-ignore-next-line pera/no-wc-imports-in-connections-module reason: the composition root is the one place the app names a handler
import { createWalletConnectV1Handler } from '@perawallet/wallet-core-walletconnect'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useConnectionsBoot } from './useConnectionsBoot'
import { useConnectionErrorToasts } from './useConnectionErrorToasts'
import { useProposalQueue } from './useProposalQueue'

/**
 * Owns the one registry for the app's lifetime: creates it, registers the
 * WalletConnect v1 handler, and composes the boot sequence, the approval
 * queue, the error toasts and the signing adapter around it.
 */
export const useConnectionsProvider = (): ConnectionRegistry => {
    const registryRef = useRef<ConnectionRegistry | null>(null)
    if (!registryRef.current) {
        const registry = createConnectionRegistry({
            store: getProvider().connections.store,
        })
        registry.register(
            createWalletConnectV1Handler({
                // Injected: a store default would drag the blockchain package
                // into every importer's graph, `apps/browser` included.
                getNetwork: () => useNetworkStore.getState().network,
            }),
        )
        registryRef.current = registry
    }
    const registry = registryRef.current

    useConnectionSigningAdapter(registry)
    useConnectionsBoot(registry)
    const proposals = useProposalQueue(registry)
    useConnectionErrorToasts(registry, proposals)

    return registry
}
