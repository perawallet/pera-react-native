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

import { decode, encode } from './decimal-codec'
import type {
    CollectionKey,
    MmkvLike,
    PersistentAdapter,
} from './types'

/**
 * In-memory stand-in for `react-native-mmkv`, suitable for unit tests and
 * the Node-side vitest runner. Accepts/returns UTF-8 strings like MMKV
 * does and supports `getAllKeys`, which is the only non-trivial surface
 * the adapter touches.
 */
export class InMemoryMmkv implements MmkvLike {
    private readonly store = new Map<string, string>()

    set(key: string, value: string): void {
        this.store.set(key, value)
    }

    getString(key: string): string | undefined {
        return this.store.get(key)
    }

    delete(key: string): void {
        this.store.delete(key)
    }

    getAllKeys(): string[] {
        return [...this.store.keys()]
    }

    /** Test helper — used by `beforeEach` to wipe state between tests. */
    clear(): void {
        this.store.clear()
    }

    /** Test helper — inspect the raw storage. */
    snapshot(): ReadonlyMap<string, string> {
        return this.store
    }
}

/**
 * A lightweight, in-process `PersistentAdapter` for unit tests.
 *
 * Unlike `MmkvAdapter`, this one does not go through the JSON codec —
 * it stores value references directly in a `Map`. That's deliberate:
 * tests that want to verify codec round-trips should do so against
 * `MmkvAdapter` + `InMemoryMmkv`, which exercises the real serialization
 * path. Tests of the collection layer and repositories don't care how
 * persistence works; they want fast, allocation-cheap storage.
 *
 * If a test wants to verify the adapter *and* the codec together, pass
 * `{ roundTripThroughJson: true }` and the adapter will serialize
 * through the Decimal codec the same way MmkvAdapter does.
 */
export class MemoryAdapter<TValue> implements PersistentAdapter<TValue> {
    readonly name: string
    readonly schemaVersion: number
    private entries = new Map<CollectionKey, TValue>()
    private readonly roundTripThroughJson: boolean

    constructor(options: {
        name: string
        schemaVersion?: number
        roundTripThroughJson?: boolean
    }) {
        this.name = options.name
        this.schemaVersion = options.schemaVersion ?? 1
        this.roundTripThroughJson = options.roundTripThroughJson ?? false
    }

    hydrate(): Map<CollectionKey, TValue> {
        return new Map(this.entries)
    }

    put(key: CollectionKey, value: TValue): void {
        this.entries.set(key, this.clone(value))
    }

    putMany(
        entries: ReadonlyArray<readonly [CollectionKey, TValue]>,
    ): void {
        for (const [key, value] of entries) {
            this.entries.set(key, this.clone(value))
        }
    }

    delete(key: CollectionKey): void {
        this.entries.delete(key)
    }

    deleteMany(keys: readonly CollectionKey[]): void {
        for (const key of keys) {
            this.entries.delete(key)
        }
    }

    deleteAll(): void {
        this.entries.clear()
    }

    /** Test helper — inspect the underlying map. */
    snapshot(): ReadonlyMap<CollectionKey, TValue> {
        return this.entries
    }

    private clone(value: TValue): TValue {
        if (!this.roundTripThroughJson) return value
        return decode<TValue>(encode(value))
    }
}
