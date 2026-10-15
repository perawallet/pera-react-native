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

import type { QueryClient } from '@tanstack/react-query'
import type {
    ChainId,
    ChainRegistry,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type { AssetSyncKind } from '../polling/models'

/**
 * Handler invoked after a submitted transaction group involves wallet-held
 * addresses. Declared here, not imported from `@perawallet/wallet-core-signing`,
 * to keep the dependency edge `signing → background` (not the reverse). It
 * takes the legacy `Network` where signing's `OnConfirmedHandler` takes a
 * scope, so the app adapts between them.
 */
export type SyncCompletionHandler = (
    addresses: string[],
    network: Network,
) => void | Promise<void>

/** One account's address on one chain it holds an entry for. */
export type AccountChainAddress = { chainId: ChainId; address: string }

/**
 * The app state the sync loop reads and the per-scope cursor it writes.
 * Injected so the service never reaches into global stores;
 * `createSyncStorePorts` is the store-backed implementation every app wires in.
 */
export type SyncStorePorts = {
    /** Every chain entry of every account, in account order. */
    getAccountChainAddresses: () => AccountChainAddress[]
    getSelectedScope: (chainId: ChainId) => ChainScope
    /** Null for a scope never synced, including one absent from the map. */
    getChangeCursor: (scope: ChainScope) => Nullable<number>
    setChangeCursor: (scope: ChainScope, cursor: number) => void
    /** Epoch ms of the last successful pass of `kind`; null when it never ran. */
    getLastSyncAt: (scope: ChainScope, kind: AssetSyncKind) => Nullable<number>
    setLastSyncAt: (
        scope: ChainScope,
        kind: AssetSyncKind,
        atMs: number,
    ) => void
}

export type SyncServiceDeps = {
    queryClient: QueryClient
    stores: SyncStorePorts
    /** The kill switch, and the chains whose open submissions each tick settles. */
    chains: ChainRegistry
    /**
     * Optional registration function for the post-confirmation refresh
     * hook. When provided, `initializeSyncService` wires the freshly-built
     * SyncService instance into the registry so `submitAndAutoRefresh`
     * (in @perawallet/wallet-core-signing) can call back without the
     * background package depending on signing.
     */
    registerCompletionHandler?: (handler: SyncCompletionHandler) => void
    /**
     * Base poll cadence in ms (default 3000). The offscreen document uses a
     * slow cadence (warm polling) so it never competes with a focused UI
     * context's 3s loop for API budget.
     */
    pollIntervalMs?: number
}
