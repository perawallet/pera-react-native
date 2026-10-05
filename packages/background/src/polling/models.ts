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

import type { ChainScopeKey } from '@perawallet/wallet-core-chain-contract'
import type {
    BaseStoreState,
    Network,
    Nullable,
} from '@perawallet/wallet-core-shared'

export type AssetSyncKind = 'assets' | 'prices'

export interface SyncCursor {
    /** Algorand round the account pass last observed; null until a network first syncs. */
    refreshRound: Nullable<number>
    /** Epoch ms of the last successful asset-metadata pass. */
    lastAssetSyncAt: Nullable<number>
    /** Epoch ms of the last successful price pass. */
    lastPriceSyncAt: Nullable<number>
}

/** An absent scope has never synced. */
export type SyncCursors = Partial<Record<ChainScopeKey, SyncCursor>>

export type SyncCursorState = {
    cursors: SyncCursors
}

export type SyncCursorActions = BaseStoreState & {
    setRefreshRound: (network: Network, round: Nullable<number>) => void
    markSynced: (network: Network, kind: AssetSyncKind, atMs: number) => void
}

export type SyncCursorStore = SyncCursorState & SyncCursorActions

export type ShouldRefreshResponse = {
    refresh: boolean
    round: number
}
