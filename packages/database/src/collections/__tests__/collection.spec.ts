/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect } from 'vitest'
import { MemoryAdapter } from '../adapter/memory-adapter'
import { Collection } from '../collection'

type Row = { network: string; address: string; value: number }

function makeCollection(): {
    collection: Collection<Row>
    adapter: MemoryAdapter<Row>
} {
    const adapter = new MemoryAdapter<Row>({ name: 'rows' })
    const collection = new Collection<Row>({
        name: 'rows',
        adapter,
        getKey: row => `${row.network}:${row.address}`,
    })
    return { collection, adapter }
}

describe('Collection', () => {
    it('upsert stores values and writes through to the adapter', () => {
        const { collection, adapter } = makeCollection()
        collection.upsert({ network: 'main', address: 'a', value: 1 })

        expect(collection.get('main:a')).toEqual({
            network: 'main',
            address: 'a',
            value: 1,
        })
        expect(adapter.snapshot().get('main:a')).toEqual({
            network: 'main',
            address: 'a',
            value: 1,
        })
    })

    it('upsert notifies subscribers', () => {
        const { collection } = makeCollection()
        let calls = 0
        collection.subscribe(() => {
            calls += 1
        })

        collection.upsert({ network: 'main', address: 'a', value: 1 })
        collection.upsert({ network: 'main', address: 'a', value: 2 })

        expect(calls).toBe(2)
    })

    it('transact batches notifications to one emit at commit', () => {
        const { collection } = makeCollection()
        let calls = 0
        collection.subscribe(() => {
            calls += 1
        })

        collection.transact(() => {
            collection.upsert({ network: 'main', address: 'a', value: 1 })
            collection.upsert({ network: 'main', address: 'b', value: 2 })
            collection.upsert({ network: 'main', address: 'c', value: 3 })
        })

        expect(calls).toBe(1)
        expect(collection.size).toBe(3)
    })

    it('transact flushes to the adapter via putMany on commit', () => {
        const { collection, adapter } = makeCollection()

        collection.transact(() => {
            collection.upsert({ network: 'main', address: 'a', value: 1 })
            collection.upsert({ network: 'main', address: 'b', value: 2 })
        })

        expect(adapter.snapshot().size).toBe(2)
    })

    it('nested transact collapses into the outermost commit', () => {
        const { collection } = makeCollection()
        let calls = 0
        collection.subscribe(() => {
            calls += 1
        })

        collection.transact(() => {
            collection.upsert({ network: 'main', address: 'a', value: 1 })
            collection.transact(() => {
                collection.upsert({ network: 'main', address: 'b', value: 2 })
            })
        })

        expect(calls).toBe(1)
    })

    it('delete removes the row and notifies subscribers', () => {
        const { collection, adapter } = makeCollection()
        collection.upsert({ network: 'main', address: 'a', value: 1 })

        let notified = false
        collection.subscribe(() => {
            notified = true
        })

        expect(collection.delete('main:a')).toBe(true)
        expect(collection.get('main:a')).toBeUndefined()
        expect(adapter.snapshot().has('main:a')).toBe(false)
        expect(notified).toBe(true)
    })

    it('delete of a missing key is a no-op and does not notify', () => {
        const { collection } = makeCollection()
        let notified = false
        collection.subscribe(() => {
            notified = true
        })
        expect(collection.delete('missing')).toBe(false)
        expect(notified).toBe(false)
    })

    it('entriesWithPrefix scans composite-key prefixes', () => {
        const { collection } = makeCollection()
        collection.transact(() => {
            collection.upsert({ network: 'main', address: 'a', value: 1 })
            collection.upsert({ network: 'main', address: 'b', value: 2 })
            collection.upsert({ network: 'test', address: 'a', value: 3 })
        })

        const mainRows = [...collection.entriesWithPrefix('main:')]
        expect(mainRows).toHaveLength(2)
        expect(mainRows.map(([_, r]) => r.address).sort()).toEqual(['a', 'b'])
    })

    it('deleteWhere removes matching rows atomically and notifies once', () => {
        const { collection } = makeCollection()
        collection.transact(() => {
            collection.upsert({ network: 'main', address: 'a', value: 1 })
            collection.upsert({ network: 'main', address: 'b', value: 2 })
            collection.upsert({ network: 'test', address: 'a', value: 3 })
        })

        let calls = 0
        collection.subscribe(() => {
            calls += 1
        })

        const removed = collection.deleteWhere(row => row.network === 'main')

        expect(removed).toBe(2)
        expect(collection.size).toBe(1)
        expect(calls).toBe(1)
    })

    it('clear wipes state and adapter in one notification', () => {
        const { collection, adapter } = makeCollection()
        collection.upsert({ network: 'main', address: 'a', value: 1 })
        collection.upsert({ network: 'main', address: 'b', value: 2 })

        let calls = 0
        collection.subscribe(() => {
            calls += 1
        })

        collection.clear()

        expect(collection.size).toBe(0)
        expect(adapter.snapshot().size).toBe(0)
        expect(calls).toBe(1)
    })

    it('hydrate is called once at construction, so rehydrating is idempotent for the adapter', () => {
        const adapter = new MemoryAdapter<Row>({ name: 'rows' })
        adapter.put('main:seed', { network: 'main', address: 'seed', value: 99 })

        const collection = new Collection<Row>({
            name: 'rows',
            adapter,
            getKey: row => `${row.network}:${row.address}`,
        })

        expect(collection.get('main:seed')).toEqual({
            network: 'main',
            address: 'seed',
            value: 99,
        })
    })
})
