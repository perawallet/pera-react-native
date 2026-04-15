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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { InMemoryMmkv } from '../adapter/memory-adapter'
import { MmkvAdapter } from '../adapter/mmkv-adapter'

type Row = {
    id: string
    amount: Decimal
    updatedAt: number
}

function makeAdapter(
    mmkv: InMemoryMmkv,
    schemaVersion = 1,
): MmkvAdapter<Row> {
    return new MmkvAdapter<Row>({
        name: 'rows',
        schemaVersion,
        mmkv,
    })
}

describe('MmkvAdapter', () => {
    let mmkv: InMemoryMmkv

    beforeEach(() => {
        mmkv = new InMemoryMmkv()
    })

    it('persists and hydrates rows through the Decimal codec', () => {
        const adapter = makeAdapter(mmkv)
        adapter.put('a', {
            id: 'a',
            amount: new Decimal('1000000000000.5'),
            updatedAt: 1,
        })
        adapter.put('b', {
            id: 'b',
            amount: new Decimal('2'),
            updatedAt: 2,
        })

        const hydrated = makeAdapter(mmkv).hydrate()

        expect(hydrated.size).toBe(2)
        expect(hydrated.get('a')?.amount).toBeInstanceOf(Decimal)
        expect(hydrated.get('a')?.amount.toString()).toBe('1000000000000.5')
        expect(hydrated.get('b')?.amount.toString()).toBe('2')
    })

    it('putMany writes every entry and deleteMany removes them', () => {
        const adapter = makeAdapter(mmkv)
        adapter.putMany([
            ['a', { id: 'a', amount: new Decimal(1), updatedAt: 1 }],
            ['b', { id: 'b', amount: new Decimal(2), updatedAt: 2 }],
            ['c', { id: 'c', amount: new Decimal(3), updatedAt: 3 }],
        ])
        expect(adapter.hydrate().size).toBe(3)

        adapter.deleteMany(['a', 'b'])
        const after = adapter.hydrate()
        expect(after.size).toBe(1)
        expect(after.has('c')).toBe(true)
    })

    it('deleteAll wipes every key belonging to this collection', () => {
        const adapter = makeAdapter(mmkv)
        adapter.put('a', { id: 'a', amount: new Decimal(1), updatedAt: 1 })
        adapter.put('b', { id: 'b', amount: new Decimal(2), updatedAt: 2 })

        // Something else in MMKV (e.g. a Zustand persist key) — must
        // survive deleteAll.
        mmkv.set('zustand:accounts', '{}')

        adapter.deleteAll()

        expect(adapter.hydrate().size).toBe(0)
        expect(mmkv.getString('zustand:accounts')).toBe('{}')
    })

    it('schema version bump drops all stored rows for this collection', () => {
        const adapter = makeAdapter(mmkv, 1)
        adapter.put('a', { id: 'a', amount: new Decimal(1), updatedAt: 1 })

        // Bumping the schema version on a fresh adapter instance should
        // wipe everything — rows are re-derivable from the network, so
        // drop-and-rebuild is our migration story.
        const bumped = makeAdapter(mmkv, 2)

        expect(bumped.hydrate().size).toBe(0)
    })

    it('drops corrupt rows on hydrate instead of crashing', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const adapter = makeAdapter(mmkv)
        adapter.put('good', {
            id: 'good',
            amount: new Decimal(1),
            updatedAt: 1,
        })

        // Inject a corrupt blob under the same prefix — the adapter
        // must drop it and keep going, not throw.
        mmkv.set('tdb:rows:1:bad', '{ not valid json')

        const result = makeAdapter(mmkv).hydrate()

        expect(result.size).toBe(1)
        expect(result.has('good')).toBe(true)
        expect(warnSpy).toHaveBeenCalled()
        warnSpy.mockRestore()
    })
})
