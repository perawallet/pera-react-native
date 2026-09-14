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
    ConnectionId,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'

type State = {
    connections: Connection[]
    /** False until the first snapshot lands; an empty mirror before that looks like a wallet with no dApps. */
    isHydrated: boolean
}
type Actions = {
    setConnections: (connections: Connection[]) => void
} & BaseStoreState

export type ConnectionsStore = State & Actions

const STORE_NAME = 'connections-store'

const initialState: State = { connections: [], isHydrated: false }

/**
 * Read-through mirror of the extension's persisted store, never a source of
 * truth. Do not add `persist`: `extensions/connections` owns durability, and a
 * second copy would race its hydration timeline.
 */
export const useConnectionsStore = create<ConnectionsStore>(set => ({
    ...initialState,
    setConnections: connections => set({ connections, isHydrated: true }),
    resetState: () => set(initialState),
}))

// A wipe must clear the mirror too, or it keeps `isHydrated: true` over a
// frozen snapshot until the provider reboots. The extension store owns storage.
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

    // Subscribe before the initial `list()`: a mutation notifying while it is
    // in flight would otherwise be clobbered by the stale snapshot. `stopped`
    // covers a teardown before it resolves (StrictMode mount/cleanup/mount).
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

/**
 * The persisted record decides whether a session exists; socket state is
 * irrelevant since a reconnect keeps the record. A dead answer cancels the
 * user's sign request outright, so before hydration the only safe answer is alive.
 */
export const isConnectionAlive = (connectionId: ConnectionId): boolean => {
    const { connections, isHydrated } = useConnectionsStore.getState()
    if (!isHydrated) return true
    return connections.some(connection => connection.id === connectionId)
}
