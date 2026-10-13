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

import {
    chainAccountOf,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    scopeKeyForLegacyNetwork,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import type { Network } from '@perawallet/wallet-core-shared'
import { useSyncCursorStore } from '../polling'
import type { SyncStorePorts } from '../models'

const cursorFor = (network: Network) =>
    useSyncCursorStore.getState().cursors[scopeKeyForLegacyNetwork(network)]

export const createSyncStorePorts = (): SyncStorePorts => ({
    getAccountAddresses: () =>
        useAccountsStore
            .getState()
            .accounts.flatMap(
                a => chainAccountOf(a, LEGACY_CHAIN_ID)?.address ?? [],
            ),
    getActiveNetwork: () => useNetworkStore.getState().network,
    // The persisted map can be partial, and an absent key must read as
    // never-synced (null), not as undefined — which `!== null` would treat
    // as already synced and skip the force-sync.
    getLastRefreshedRound: network => cursorFor(network)?.refreshRound ?? null,
    setLastRefreshedRound: (network, round) =>
        useSyncCursorStore.getState().setRefreshRound(network, round),
    getLastSyncAt: (network, kind) => {
        const cursor = cursorFor(network)
        return (
            (kind === 'assets'
                ? cursor?.lastAssetSyncAt
                : cursor?.lastPriceSyncAt) ?? null
        )
    },
    setLastSyncAt: (network, kind, atMs) =>
        useSyncCursorStore.getState().markSynced(network, kind, atMs),
})
