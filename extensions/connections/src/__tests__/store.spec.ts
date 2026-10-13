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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CONNECTIONS_STORAGE_KEY, createConnectionStore } from '../store'
import type { Connection, ConnectionPersistence } from '../models'

const makeStorage = (): ConnectionPersistence & {
    map: Map<string, string>
} => {
    const map = new Map<string, string>()
    return {
        map,
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
    }
}

const connection = (id: string): Connection => ({
    id,
    kind: 'walletconnect-v1',
    name: 'Tinyman',
    peer: { name: 'Tinyman' },
    accounts: ['AAAA'],
    status: 'active',
    createdAt: 1,
    lastActiveAt: 2,
})

describe('createConnectionStore', () => {
    let storage: ReturnType<typeof makeStorage>

    beforeEach(() => {
        storage = makeStorage()
    })

    it('round-trips a connection through persistence', async () => {
        const store = createConnectionStore({ storage })
        await store.upsert(connection('a'))

        const reloaded = createConnectionStore({ storage })
        expect(await reloaded.get('a')).toMatchObject({ id: 'a' })
    })

    it('upsert replaces rather than duplicates', async () => {
        const store = createConnectionStore({ storage })
        await store.upsert(connection('a'))
        await store.upsert({ ...connection('a'), name: 'Renamed' })

        const all = await store.list()
        expect(all).toHaveLength(1)
        expect(all[0].name).toBe('Renamed')
    })

    it('drops malformed persisted records instead of returning them', async () => {
        storage.setItem(
            CONNECTIONS_STORAGE_KEY,
            JSON.stringify([connection('good'), { id: 'bad' }]),
        )
        const store = createConnectionStore({ storage })

        expect(await store.list()).toHaveLength(1)
    })

    it('survives a corrupt persisted blob', async () => {
        storage.setItem(CONNECTIONS_STORAGE_KEY, 'not json')
        const store = createConnectionStore({ storage })

        expect(await store.list()).toEqual([])
    })

    it('notifies subscribers on mutation and stops after unsubscribe', async () => {
        const store = createConnectionStore({ storage })
        const listener = vi.fn()
        const unsubscribe = store.subscribe(listener)

        await store.upsert(connection('a'))
        expect(listener).toHaveBeenCalledTimes(1)
        expect(listener).toHaveBeenLastCalledWith([
            expect.objectContaining({ id: 'a' }),
        ])

        unsubscribe()
        await store.upsert(connection('b'))
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('remove and clear both persist', async () => {
        const store = createConnectionStore({ storage })
        await store.upsert(connection('a'))
        await store.upsert(connection('b'))

        await store.remove('a')
        expect(await store.list()).toHaveLength(1)

        await store.clear()
        await expect(
            createConnectionStore({ storage }).list(),
        ).resolves.toEqual([])
    })
})
