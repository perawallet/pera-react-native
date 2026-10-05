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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
    rekeyLegacyNetworkRecord,
    scopeKeyForLegacyNetwork,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    registerStore,
    type Network,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    AssetSyncKind,
    SyncCursor,
    SyncCursorState,
    SyncCursorStore,
    SyncCursors,
} from './models'
import { getProvider } from '@perawallet/wallet-extension-provider'

// Kept from when this was the polling store: existing installs rehydrate from
// it, and the browser offscreen context listens for writes to `kv:polling-store`.
const STORE_NAME = 'polling-store'

const initialState: SyncCursorState = {
    cursors: {},
}

const EMPTY_CURSOR: SyncCursor = {
    refreshRound: null,
    lastAssetSyncAt: null,
    lastPriceSyncAt: null,
}

const SYNCED_AT_FIELD = {
    assets: 'lastAssetSyncAt',
    prices: 'lastPriceSyncAt',
} as const satisfies Record<AssetSyncKind, keyof SyncCursor>

type PersistedSyncCursorState = {
    lastRefreshedRound?: Partial<Record<string, Nullable<number>>>
    cursors?: SyncCursors
}

/**
 * v0 keyed `lastRefreshedRound` by the bare network; v1 by ChainScopeKey; v2
 * folds it into one cursor per scope.
 */
export const migrateSyncCursorState = (
    persistedState: unknown,
    version: number,
): PersistedSyncCursorState => {
    let state = (persistedState ?? {}) as PersistedSyncCursorState
    if (version < 1) {
        state = {
            ...state,
            lastRefreshedRound: rekeyLegacyNetworkRecord(
                state.lastRefreshedRound,
            ),
        }
    }
    if (version < 2) {
        const { lastRefreshedRound, ...rest } = state
        const cursors: SyncCursors = {}
        for (const [key, round] of Object.entries(lastRefreshedRound ?? {})) {
            if (round === null || round === undefined) continue
            cursors[key as ChainScopeKey] = {
                ...EMPTY_CURSOR,
                refreshRound: round,
            }
        }
        state = { ...rest, cursors }
    }
    return state
}

const patchCursor = (
    cursors: SyncCursors,
    network: Network,
    patch: Partial<SyncCursor>,
): SyncCursors => {
    const key = scopeKeyForLegacyNetwork(network)
    return {
        ...cursors,
        [key]: { ...EMPTY_CURSOR, ...cursors[key], ...patch },
    }
}

export const useSyncCursorStore: UseBoundStore<
    WithPersist<StoreApi<SyncCursorStore>, unknown>
> = create<SyncCursorStore>()(
    persist(
        set => ({
            ...initialState,
            setRefreshRound: (network: Network, round: Nullable<number>) => {
                set(state => ({
                    cursors: patchCursor(state.cursors, network, {
                        refreshRound: round,
                    }),
                }))
            },
            markSynced: (
                network: Network,
                kind: AssetSyncKind,
                atMs: number,
            ) => {
                set(state => ({
                    cursors: patchCursor(state.cursors, network, {
                        [SYNCED_AT_FIELD[kind]]: atMs,
                    }),
                }))
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 2,
            migrate: migrateSyncCursorState,
            partialize: state => ({
                cursors: state.cursors,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useSyncCursorStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSyncCursorStore.getState().resetState(),
})
