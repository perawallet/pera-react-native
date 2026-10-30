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
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { config } from '@perawallet/wallet-core-config'
import {
    createConnectionRegistry,
    useConnectionSigningAdapter,
    watchWalletNotices,
    type ConnectionRegistry,
} from '@perawallet/wallet-core-connections'
// lanekeep-ignore-next-line pera/no-wc-imports-in-connections-module reason: the composition root is the one place the app names a handler
import { createWalletConnectV1Handler } from '@perawallet/wallet-core-walletconnect'
// lanekeep-ignore-next-line pera/no-wc-imports-in-connections-module reason: the composition root is the one place the app names a handler
import { createWalletConnectV2Handler } from '@perawallet/wallet-core-walletconnect/v2'
import { whenAppUnlocked } from '@perawallet/wallet-core-security'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    clearActiveWalletConnectV1Delivery,
    setActiveWalletConnectV1Delivery,
} from '@modules/walletconnect'
import { useShowDappTransaction } from '../hooks'
import { useConnectionsBoot } from './useConnectionsBoot'
import { useConnectionErrorToasts } from './useConnectionErrorToasts'
import { useNetworkSwitchPrompt } from './useNetworkSwitchPrompt'
import { useProposalQueue } from './useProposalQueue'

const getNetworkId = (chainId: ChainId) => getSelectedScope(chainId).networkId

/**
 * The handler factories run synchronously during render, before
 * `useConnectionsBoot`, so one that threw would take the whole provider — and
 * every other handler — down with it. Both build their transports inside
 * `initialize()` instead.
 */
export const useConnectionsProvider = (): ConnectionRegistry => {
    const registryRef = useRef<Nullable<ConnectionRegistry>>(null)
    const v1HandlerRef =
        useRef<Nullable<ReturnType<typeof createWalletConnectV1Handler>>>(null)
    if (!registryRef.current) {
        const registry = createConnectionRegistry({
            store: getProvider().connections.store,
        })
        // Injected, on both handlers: a store default would drag the
        // blockchain package into every importer's graph, `apps/browser`
        // included.
        const v1Handler = createWalletConnectV1Handler({
            chainId: LEGACY_CHAIN_ID,
            getNetworkId,
        })
        registry.register(v1Handler)
        v1HandlerRef.current = v1Handler
        registry.register(
            createWalletConnectV2Handler({
                getNetworkId,
                isDappConnectEnabled: chainId => {
                    const { chains } = getProvider()
                    return (
                        chains.has(chainId) &&
                        chains.capabilities(chainId).dappConnect
                    )
                },
                // Empty when no Reown project is provisioned for the build;
                // the handler then logs and refuses v2 pairings rather than
                // failing the boot.
                projectId: config.reownProjectId,
                keyValueStorage: getProvider().keyValueStorage,
                // Loading the v2 SDK holds the JS thread for seconds; at boot
                // that delayed the PIN pad and the biometric prompt.
                startWhen: whenAppUnlocked,
            }),
        )
        registryRef.current = registry
    }
    const registry = registryRef.current

    useEffect(() => {
        const v1Handler = v1HandlerRef.current
        if (!v1Handler) return
        setActiveWalletConnectV1Delivery(v1Handler)
        return () => clearActiveWalletConnectV1Delivery(v1Handler)
    }, [])

    const confirmNetworkSwitch = useNetworkSwitchPrompt()
    const showTransaction = useShowDappTransaction()
    useConnectionSigningAdapter(registry, LEGACY_CHAIN_ID, {
        confirmNetworkSwitch,
        showTransaction,
    })
    useEffect(() => watchWalletNotices(registry), [registry])
    useConnectionsBoot(registry)
    const proposals = useProposalQueue(registry)
    useConnectionErrorToasts(registry, proposals)

    return registry
}
