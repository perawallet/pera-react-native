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

import { create } from 'zustand'
import {
    registerStore,
    type BaseStoreState,
} from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'

type State = {
    connections: Connection[]
    /**
     * False until the first snapshot lands. An empty mirror before that is
     * indistinguishable from a wallet with no dApps.
     */
    isHydrated: boolean
}
type Actions = {
    setConnections: (connections: Connection[]) => void
} & BaseStoreState

export type ConnectionsStore = State & Actions

const STORE_NAME = 'connections-store'

const initialState: State = { connections: [], isHydrated: false }

/**
 * UI-facing mirror of the extension's persisted store, kept for screens that
 * follow the repo's zustand convention (granular selectors, `resetState`).
 *
 * Deliberately NOT `persist`-backed. `extensions/connections` already owns
 * durability for these records; wiring `persist` here would create a second
 * copy with its own hydration timeline racing the extension's — the exact
 * hazard this project's design already works around. This store is a
 * read-through mirror, never a source of truth. Do not add `persist`.
 */
export const useConnectionsStore = create<ConnectionsStore>(set => ({
    ...initialState,
    setConnections: connections => set({ connections, isHydrated: true }),
    resetState: () => set(initialState),
}))

// A wipe must clear the mirror too: left alone it keeps `isHydrated: true`
// over a frozen snapshot until the provider reboots. Nothing to clear from
// storage — the extension store owns durability.
registerStore({
    name: STORE_NAME,
    clearStorage: () => {},
    resetState: () => useConnectionsStore.getState().resetState(),
})

/** Hydrate from, and then track, the persisted store. Returns a teardown. */
export const hydrateConnectionsStore = (
    api: ConnectionStoreAPI,
): (() => void) => {
    const { setConnections } = useConnectionsStore.getState()

    // Subscribe BEFORE requesting the initial list, and guard the initial
    // list's apply behind two flags. `list()` is async: if a mutation lands
    // (and notifies synchronously, as most in-memory/test doubles do) while
    // that promise is still in flight, its resolution can settle AFTER the
    // mutation's own notification and clobber newer state with a stale
    // snapshot — `initialListIsStale` covers that case. Separately, if the
    // CALLER tears down before the initial `list()` resolves (React
    // StrictMode's synchronous mount/cleanup/mount is exactly this shape),
    // there may be no intervening mutation to flip that flag at all — the
    // pending `.then` would otherwise fire after teardown and write a stale
    // snapshot into the module-singleton store even though the caller
    // believes tracking has stopped. `stopped` covers that case
    // independently: it is set only by the returned teardown, never by a
    // subscription update.
    let stopped = false
    let initialListIsStale = false
    const unsubscribe = api.subscribe(connections => {
        initialListIsStale = true
        setConnections(connections)
    })
    void api.list().then(connections => {
        if (!stopped && !initialListIsStale) setConnections(connections)
    })
    return () => {
        stopped = true
        unsubscribe()
    }
}
