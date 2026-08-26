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
import { useQueryClient } from '@tanstack/react-query'
import {
    getSyncService,
    releaseNetworkScopedQueries,
} from '@perawallet/wallet-core-background'
import { useNetwork } from '@perawallet/wallet-core-blockchain'

/**
 * Single owner of the on-network-switch query invalidation. The imperative
 * switch paths (header menu, node settings, custom-network sheet) only
 * restart() the sync service and rely on this hook — mounted once per shell
 * (RootComponent on native, AppShellThemedRoot on web) — so one switch fires
 * exactly one invalidation pass instead of two. The first-run guard keeps
 * cold start from invalidating the disk-hydrated cache before anything
 * changed.
 */
export const useNetworkSwitchInvalidation = (): void => {
    const { network } = useNetwork()
    const queryClient = useQueryClient()
    const previousNetwork = useRef(network)

    useEffect(() => {
        if (previousNetwork.current === network) return
        const departed = previousNetwork.current
        previousNetwork.current = network
        releaseNetworkScopedQueries(queryClient, departed)
        try {
            getSyncService().invalidateQueries()
        } catch {
            // SyncService not yet initialized
        }
    }, [network, queryClient])
}
