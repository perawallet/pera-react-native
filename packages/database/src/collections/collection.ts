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

import type { CollectionKey, PersistentAdapter } from './adapter'

/**
 * A reactive, in-memory collection backed by a durable `PersistentAdapter`.
 *
 * Design intent: this layer is API-shaped to be a drop-in replacement for
 * an eventual `@tanstack/db` LocalOnly collection. The public surface —
 * `get` / `has` / `state` / `insert` / `update` / `upsert` / `delete` /
 * `transact` / `subscribe` — mirrors TanStack DB's semantics so that once
 * the upstream beta stabilizes, the swap is localized to `registry.ts`
 * and nothing else. Everything outside the registry talks to this type.
 *
 * Properties it guarantees today:
 *
 *   - Reads are synchronous `Map` lookups over the in-memory state.
 *   - Writes are synchronous: adapter flush happens inside `insert` /
 *     `delete`. `transact` batches notifications (and gives the adapter
 *     a chance to batch IO via `putMany` / `deleteMany`) but still flushes
 *     per-op on commit — the adapter is free to buffer internally if it
 *     wants.
 *   - Subscribers are notified at most once per top-level mutation or
 *     per `transact` commit. During a transaction, intermediate writes
 *     do not fire listeners.
 *   - `hydrate()` is called once at construction; thereafter the
 *     in-memory state is the source of truth for reads.
 */
export class Collection<TValue> {
    readonly name: string
    private readonly adapter: PersistentAdapter<TValue>
    private readonly getKey: (value: TValue) => CollectionKey

    private entries: Map<CollectionKey, TValue>
    private readonly listeners = new Set<() => void>()

    private transactDepth = 0
    private pendingNotify = false

    // Buffered writes inside a transaction. Flushed to the adapter on
    // commit so we can use `putMany` / `deleteMany` for batching.
    private pendingPuts: Array<readonly [CollectionKey, TValue]> | null = null
    private pendingDeletes: CollectionKey[] | null = null

    constructor(options: {
        name: string
        adapter: PersistentAdapter<TValue>
        getKey: (value: TValue) => CollectionKey
    }) {
        this.name = options.name
        this.adapter = options.adapter
        this.getKey = options.getKey
        this.entries = options.adapter.hydrate()
    }

    // --- Reads -----------------------------------------------------------

    get(key: CollectionKey): TValue | undefined {
        return this.entries.get(key)
    }

    has(key: CollectionKey): boolean {
        return this.entries.has(key)
    }

    get size(): number {
        return this.entries.size
    }

    /** Current state as a read-only map. Stable reference until the next write. */
    get state(): ReadonlyMap<CollectionKey, TValue> {
        return this.entries
    }

    /** Convenience: every value as an array. Allocates. */
    values(): TValue[] {
        return [...this.entries.values()]
    }

    /**
     * Iterate every value whose key starts with `prefix`. Used by the
     * domain query patterns that previously relied on SQL prefix matching
     * (`WHERE network = ? AND address = ?` on composite keys).
     *
     * Implemented as a linear scan over the collection — acceptable at
     * the collection sizes we persist (100s of rows per account for the
     * hot collections; 1000s for transactions, addressed separately via
     * denormalized indexes in the consuming repositories).
     */
    *entriesWithPrefix(
        prefix: string,
    ): IterableIterator<readonly [CollectionKey, TValue]> {
        for (const entry of this.entries) {
            if (entry[0].startsWith(prefix)) yield entry
        }
    }

    // --- Writes ----------------------------------------------------------

    /**
     * Insert or update by key. Idempotent — matches the upsert semantics
     * the SQLite repositories used throughout.
     */
    upsert(value: TValue): void {
        const key = this.getKey(value)
        this.entries.set(key, value)
        this.queuePut(key, value)
        this.notify()
    }

    upsertMany(values: readonly TValue[]): void {
        if (values.length === 0) return
        this.transact(() => {
            for (const value of values) this.upsert(value)
        })
    }

    delete(key: CollectionKey): boolean {
        const existed = this.entries.delete(key)
        if (existed) {
            this.queueDelete(key)
            this.notify()
        }
        return existed
    }

    deleteWhere(predicate: (value: TValue, key: CollectionKey) => boolean): number {
        const toDelete: CollectionKey[] = []
        for (const [key, value] of this.entries) {
            if (predicate(value, key)) toDelete.push(key)
        }
        if (toDelete.length === 0) return 0
        this.transact(() => {
            for (const key of toDelete) this.delete(key)
        })
        return toDelete.length
    }

    /**
     * Run `fn` as a single logical mutation. Listeners are notified once
     * at commit (instead of once per intermediate write), and buffered
     * writes are flushed to the adapter via `putMany` / `deleteMany`.
     *
     * Re-entrant: nested `transact` calls collapse into the outermost
     * commit.
     */
    transact(fn: () => void): void {
        if (this.transactDepth === 0) {
            this.pendingPuts = []
            this.pendingDeletes = []
        }
        this.transactDepth += 1
        try {
            fn()
        } finally {
            this.transactDepth -= 1
            if (this.transactDepth === 0) {
                this.commitPending()
                if (this.pendingNotify) {
                    this.pendingNotify = false
                    this.emit()
                }
            }
        }
    }

    /** Reset to an empty collection, synchronously flushing to the adapter. */
    clear(): void {
        if (this.entries.size === 0) return
        this.entries = new Map()
        this.adapter.deleteAll()
        this.notify()
    }

    // --- Subscriptions ---------------------------------------------------

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    // --- Internals -------------------------------------------------------

    private queuePut(key: CollectionKey, value: TValue): void {
        if (this.pendingPuts !== null) {
            this.pendingPuts.push([key, value])
        } else {
            this.adapter.put(key, value)
        }
    }

    private queueDelete(key: CollectionKey): void {
        if (this.pendingDeletes !== null) {
            this.pendingDeletes.push(key)
        } else {
            this.adapter.delete(key)
        }
    }

    private commitPending(): void {
        if (this.pendingPuts !== null && this.pendingPuts.length > 0) {
            this.adapter.putMany(this.pendingPuts)
        }
        if (this.pendingDeletes !== null && this.pendingDeletes.length > 0) {
            this.adapter.deleteMany(this.pendingDeletes)
        }
        this.pendingPuts = null
        this.pendingDeletes = null
    }

    private notify(): void {
        if (this.transactDepth > 0) {
            this.pendingNotify = true
            return
        }
        this.emit()
    }

    private emit(): void {
        for (const listener of this.listeners) listener()
    }
}
