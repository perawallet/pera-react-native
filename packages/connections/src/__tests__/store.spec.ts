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

import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllStores } from '@perawallet/wallet-core-shared'
import { hydrateConnectionsStore, useConnectionsStore } from '../store'
import type {
    Connection,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'

const connection = (id: string): Connection => ({
    id,
    kind: 'walletconnect-v1',
    name: 'Tinyman',
    peer: { name: 'Tinyman' },
    accounts: [],
    status: 'active',
    createdAt: 0,
    lastActiveAt: 0,
})

const makeApi = () => {
    let items: Connection[] = []
    const listeners = new Set<(c: Connection[]) => void>()
    const api: ConnectionStoreAPI = {
        list: async () => items,
        get: async id => items.find(c => c.id === id),
        upsert: async c => {
            items = [...items.filter(i => i.id !== c.id), c]
            listeners.forEach(l => l(items))
        },
        remove: async id => {
            items = items.filter(i => i.id !== id)
            listeners.forEach(l => l(items))
        },
        clear: async () => {
            items = []
            listeners.forEach(l => l(items))
        },
        subscribe: listener => {
            listeners.add(listener)
            return () => void listeners.delete(listener)
        },
    }
    return api
}

describe('connections store', () => {
    beforeEach(() => {
        useConnectionsStore.getState().resetState()
    })

    it('hydrates from the persisted API', async () => {
        const api = makeApi()
        await api.upsert(connection('a'))

        hydrateConnectionsStore(api)
        await Promise.resolve()

        expect(useConnectionsStore.getState().connections).toHaveLength(1)
    })

    // An empty mirror before hydration is indistinguishable from a wallet
    // with no dApps; screens need the flag to tell the two apart.
    it('reports not hydrated until the first snapshot lands', async () => {
        const api = makeApi()
        expect(useConnectionsStore.getState().isHydrated).toBe(false)

        hydrateConnectionsStore(api)
        expect(useConnectionsStore.getState().isHydrated).toBe(false)
        await Promise.resolve()

        expect(useConnectionsStore.getState().isHydrated).toBe(true)
    })

    it('counts a mutation that lands before the initial list as hydration', async () => {
        const api = makeApi()
        api.list = () => new Promise(() => {})

        hydrateConnectionsStore(api)
        await api.upsert(connection('a'))

        expect(useConnectionsStore.getState().isHydrated).toBe(true)
    })

    it('forgets hydration on reset', async () => {
        const api = makeApi()
        hydrateConnectionsStore(api)
        await Promise.resolve()

        useConnectionsStore.getState().resetState()

        expect(useConnectionsStore.getState().isHydrated).toBe(false)
    })

    it('tracks subsequent mutations', async () => {
        const api = makeApi()
        hydrateConnectionsStore(api)

        await api.upsert(connection('b'))

        expect(useConnectionsStore.getState().connections).toHaveLength(1)
    })

    it('stops tracking after the returned teardown runs', async () => {
        const api = makeApi()
        const stop = hydrateConnectionsStore(api)

        stop()
        await api.upsert(connection('c'))

        expect(useConnectionsStore.getState().connections).toHaveLength(0)
    })

    it('does not apply a late-resolving initial list after teardown, even with no intervening mutation', async () => {
        const api = makeApi()
        let resolveList: (connections: Connection[]) => void = () => {}
        const deferredList = new Promise<Connection[]>(resolve => {
            resolveList = resolve
        })
        // Simulate the initial `list()` call still being in flight when the
        // caller tears down — no `upsert`/`remove`/`clear` runs in between,
        // so nothing flips a "this is stale" flag via `subscribe`.
        api.list = () => deferredList

        const stop = hydrateConnectionsStore(api)
        stop()

        resolveList([connection('late')])
        await deferredList
        await Promise.resolve()

        expect(useConnectionsStore.getState().connections).toHaveLength(0)
    })

    it('is reset by a wipe, so the mirror does not survive one as hydrated', async () => {
        const api = makeApi()
        await api.upsert(connection('wiped'))
        hydrateConnectionsStore(api)
        await Promise.resolve()

        clearAllStores()

        expect(useConnectionsStore.getState()).toMatchObject({
            connections: [],
            isHydrated: false,
        })
    })
})
