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
import { getSyncService } from '@perawallet/wallet-core-background'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    isAccountBalancesHistoryQuery,
    isAccountQuery,
} from '@perawallet/wallet-core-accounts'
import {
    isAssetPriceHistoryQuery,
    isAssetQuery,
} from '@perawallet/wallet-core-assets'
import { isTransactionQuery } from '@perawallet/wallet-core-transactions'
import type { QueryKey } from '@tanstack/react-query'
import type { Network } from '@perawallet/wallet-core-shared'
import { queryClient } from '../providers/queryClient'

// Every DB-backed key factory embeds the network either as a bare string
// element or as a `network` field of an object element.
const keyReferencesNetwork = (queryKey: QueryKey, network: Network): boolean =>
    queryKey.some(
        part =>
            part === network ||
            (typeof part === 'object' &&
                part !== null &&
                (part as { network?: unknown }).network === network),
    )

/**
 * Drops the departed network's DB-backed cache entries instead of letting the
 * 1-hour default gcTime retain them. On a 10k-asset wallet each holdings-shaped
 * entry is a multi-MB hydrated array, so a few switches ratchet the heap until
 * GC pauses dominate the JS thread (PERA-4953). SQLite is the source of truth
 * for all of these — a re-read on switch-back is cheap. The persisted chart
 * histories (network-only, no SQLite backing) are deliberately kept.
 */
const releasePreviousNetworkCache = (previousNetwork: Network): void => {
    queryClient.removeQueries({
        predicate: query => {
            const key = query.queryKey
            if (
                isAccountBalancesHistoryQuery(key) ||
                isAssetPriceHistoryQuery(key)
            ) {
                return false
            }
            if (
                !isAccountQuery(key) &&
                !isAssetQuery(key) &&
                !isTransactionQuery(key)
            ) {
                return false
            }
            return keyReferencesNetwork(key, previousNetwork)
        },
    })
}

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
    const previousNetwork = useRef(network)

    useEffect(() => {
        if (previousNetwork.current === network) return
        const departed = previousNetwork.current
        previousNetwork.current = network
        releasePreviousNetworkCache(departed)
        try {
            getSyncService().invalidateQueries()
        } catch {
            // SyncService not yet initialized
        }
    }, [network])
}
