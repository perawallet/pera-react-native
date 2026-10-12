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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { create } from 'zustand'
import {
    guardedPersist,
    quarantineKeyFor,
    readQuarantinedStates,
    type GuardedPersistOptions,
    type QuarantinableStorage,
} from '../guarded-persist'
import { logger } from '../logging'

vi.mock('../logging', () => ({
    logger: { critical: vi.fn(), warn: vi.fn() },
}))

const NAME = 'items-store'

type ItemsState = {
    items: string[]
    add: (item: string) => void
}

const createMemoryStorage = (): QuarantinableStorage & {
    data: Map<string, string>
} => {
    const data = new Map<string, string>()
    return {
        data,
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value)
        },
        removeItem: key => {
            data.delete(key)
        },
    }
}

const createItemsStore = (
    storage: QuarantinableStorage,
    options: Partial<GuardedPersistOptions<ItemsState, { items: string[] }>>,
) =>
    create<ItemsState>()(
        guardedPersist(
            set => ({
                items: [],
                add: item => set(state => ({ items: [...state.items, item] })),
            }),
            {
                name: NAME,
                storage: () => storage,
                version: 2,
                partialize: state => ({ items: state.items }),
                ...options,
            },
        ),
    )

const stored = (state: unknown, version: number): string =>
    JSON.stringify({ state, version })

describe('guardedPersist', () => {
    let storage: ReturnType<typeof createMemoryStorage>

    beforeEach(() => {
        vi.clearAllMocks()
        storage = createMemoryStorage()
    })

    it('hydrates and migrates like persist when nothing fails', () => {
        storage.setItem(NAME, stored({ list: ['a'] }, 1))

        const store = createItemsStore(storage, {
            migrate: state => ({ items: (state as { list: string[] }).list }),
        })

        expect(store.getState().items).toEqual(['a'])
        expect(JSON.parse(storage.getItem(NAME)!)).toEqual({
            state: { items: ['a'] },
            version: 2,
        })
        expect(readQuarantinedStates(storage, NAME)).toEqual([])
        expect(logger.critical).not.toHaveBeenCalled()
    })

    it('quarantines the raw blob when migrate throws, so a later write cannot erase it', () => {
        const raw = stored({ list: ['a', 'b'] }, 1)
        storage.setItem(NAME, raw)

        const store = createItemsStore(storage, {
            migrate: () => {
                throw new Error('bad shape')
            },
        })
        store.getState().add('fresh')

        expect(store.getState().items).toEqual(['fresh'])
        expect(readQuarantinedStates(storage, NAME)).toEqual([
            expect.objectContaining({
                reason: 'migrate-failed',
                storedVersion: 1,
                codeVersion: 2,
                raw,
            }),
        ])
        expect(logger.critical).toHaveBeenCalledTimes(1)
    })

    it('quarantines when an async migrate rejects', async () => {
        const raw = stored({ list: ['a'] }, 1)
        storage.setItem(NAME, raw)

        const store = createItemsStore(storage, {
            migrate: () => Promise.reject(new Error('bad shape')),
        })
        await vi.waitFor(() => expect(store.persist.hasHydrated()).toBe(true))

        expect(store.getState().items).toEqual([])
        expect(readQuarantinedStates(storage, NAME)[0]?.raw).toBe(raw)
    })

    it('quarantines a blob that does not parse', () => {
        storage.setItem(NAME, '{not json')

        const store = createItemsStore(storage, {})

        expect(store.getState().items).toEqual([])
        expect(readQuarantinedStates(storage, NAME)).toEqual([
            expect.objectContaining({ reason: 'unreadable', raw: '{not json' }),
        ])
    })

    it('quarantines when merge throws and keeps the current state', () => {
        const raw = stored({ items: ['a'] }, 2)
        storage.setItem(NAME, raw)

        const store = createItemsStore(storage, {
            merge: () => {
                throw new Error('bad merge')
            },
        })

        expect(store.getState().items).toEqual([])
        expect(readQuarantinedStates(storage, NAME)).toEqual([
            expect.objectContaining({ reason: 'merge-failed', raw }),
        ])
    })

    it('quarantines an older blob when the store has no migrate', () => {
        const raw = stored({ items: ['a'] }, 1)
        storage.setItem(NAME, raw)

        const store = createItemsStore(storage, {})

        expect(store.getState().items).toEqual([])
        expect(readQuarantinedStates(storage, NAME)).toEqual([
            expect.objectContaining({ reason: 'missing-migrate', raw }),
        ])
    })

    it('copies a newer blob aside before an older build rewrites it, and only warns', () => {
        const raw = stored({ items: ['a'] }, 3)
        storage.setItem(NAME, raw)

        const store = createItemsStore(storage, {
            migrate: state => state as { items: string[] },
        })

        expect(store.getState().items).toEqual(['a'])
        expect(JSON.parse(storage.getItem(NAME)!).version).toBe(2)
        expect(readQuarantinedStates(storage, NAME)).toEqual([
            expect.objectContaining({ reason: 'newer-version', raw }),
        ])
        expect(logger.warn).toHaveBeenCalledTimes(1)
        expect(logger.critical).not.toHaveBeenCalled()
    })

    it('copies the same failing blob only once across launches', () => {
        storage.setItem(NAME, '{not json')

        createItemsStore(storage, {})
        createItemsStore(storage, {})

        expect(readQuarantinedStates(storage, NAME)).toHaveLength(1)
    })

    it('keeps earlier quarantined blobs when a later one is added', () => {
        storage.setItem(NAME, '{first')
        createItemsStore(storage, {})
        storage.setItem(NAME, '{second')
        createItemsStore(storage, {})

        expect(
            readQuarantinedStates(storage, NAME).map(entry => entry.raw),
        ).toEqual(['{first', '{second'])
    })

    it('keeps a damaged quarantine record as an entry instead of overwriting it', () => {
        storage.setItem(quarantineKeyFor(NAME), 'garbage')
        storage.setItem(NAME, '{not json')

        createItemsStore(storage, {})

        expect(
            readQuarantinedStates(storage, NAME).map(entry => entry.raw),
        ).toEqual(['garbage', '{not json'])
    })

    it('drops writes for the session when the blob cannot be copied aside', () => {
        const raw = stored({ list: ['a'] }, 1)
        storage.setItem(NAME, raw)
        const failingCopy: QuarantinableStorage = {
            ...storage,
            setItem: (key, value) => {
                if (key === quarantineKeyFor(NAME)) throw new Error('full')
                storage.setItem(key, value)
            },
        }

        const store = createItemsStore(failingCopy, {
            migrate: () => {
                throw new Error('bad shape')
            },
        })
        store.getState().add('fresh')

        expect(storage.getItem(NAME)).toBe(raw)
        expect(logger.critical).toHaveBeenCalledTimes(1)
    })

    it('drops writes for the session when the stored blob cannot be read', () => {
        storage.setItem(NAME, stored({ items: ['a'] }, 2))
        const unreadable: QuarantinableStorage = {
            ...storage,
            getItem: () => {
                throw new Error('decrypt failed')
            },
        }

        const store = createItemsStore(unreadable, {})
        store.getState().add('fresh')

        expect(JSON.parse(storage.data.get(NAME)!).state.items).toEqual(['a'])
    })

    it('clearStorage removes the quarantined copies with the store', () => {
        storage.setItem(NAME, '{not json')
        storage.setItem(quarantineKeyFor('other-store'), '[]')
        const store = createItemsStore(storage, {})

        store.persist.clearStorage()

        expect([...storage.data.keys()]).toEqual([
            quarantineKeyFor('other-store'),
        ])
    })

    it('resolves the storage once, when the store is created', () => {
        const getStorage = vi.fn(() => storage)
        const store = create<ItemsState>()(
            guardedPersist(
                set => ({
                    items: [],
                    add: item =>
                        set(state => ({ items: [...state.items, item] })),
                }),
                { name: NAME, storage: getStorage },
            ),
        )

        store.getState().add('a')
        store.getState().add('b')

        expect(getStorage).toHaveBeenCalledTimes(1)
    })

    it('leaves the store unpersisted when the storage factory throws', () => {
        const store = createItemsStore(storage, {
            storage: () => {
                throw new Error('no provider')
            },
        })

        store.getState().add('a')

        expect(store.getState().items).toEqual(['a'])
        expect(storage.data.size).toBe(0)
    })

    it('round-trips through a custom serializer', () => {
        const store = createItemsStore(storage, {
            serialize: value => `x${JSON.stringify(value)}`,
            deserialize: raw => JSON.parse(raw.slice(1)),
        })
        store.getState().add('a')

        const reloaded = createItemsStore(storage, {
            serialize: value => `x${JSON.stringify(value)}`,
            deserialize: raw => JSON.parse(raw.slice(1)),
        })

        expect(storage.getItem(NAME)?.startsWith('x')).toBe(true)
        expect(reloaded.getState().items).toEqual(['a'])
    })
})
