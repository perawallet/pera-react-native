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

import type {
    ChainScope,
    ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'

export type AssetSyncKind = 'assets' | 'prices'

export interface SyncCursor {
    /** Chain position (round or block) the scope is known synced to; null until it first syncs. */
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
    setRefreshRound: (scope: ChainScope, round: Nullable<number>) => void
    markSynced: (scope: ChainScope, kind: AssetSyncKind, atMs: number) => void
}

export type SyncCursorStore = SyncCursorState & SyncCursorActions
