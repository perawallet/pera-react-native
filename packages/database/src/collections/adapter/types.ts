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

export type CollectionKey = string

/**
 * Structural subset of the `react-native-mmkv` MMKV class that the
 * persistence adapter actually uses. Declared here so the database
 * package does not have to take a direct dependency on `react-native-mmkv`
 * and can be driven by an in-memory stub in tests.
 */
export interface MmkvLike {
    set(key: string, value: string): void
    getString(key: string): string | undefined
    delete(key: string): void
    getAllKeys(): string[]
}

/**
 * Durable, synchronous key-value storage for one TanStack DB collection.
 *
 * Each collection gets its own adapter instance with a distinct name.
 * Values are serialized/deserialized through a Decimal-aware JSON codec
 * (see decimal-codec.ts), so `Decimal` fields round-trip without loss.
 */
export interface PersistentAdapter<TValue> {
    readonly name: string
    readonly schemaVersion: number

    /**
     * Load every persisted entry for this collection into memory.
     *
     * Called once at bootstrap. Malformed entries are discarded (and the
     * underlying key deleted) rather than throwing — one corrupt row must
     * never crash app startup.
     */
    hydrate(): Map<CollectionKey, TValue>

    put(key: CollectionKey, value: TValue): void
    putMany(entries: ReadonlyArray<readonly [CollectionKey, TValue]>): void

    delete(key: CollectionKey): void
    deleteMany(keys: readonly CollectionKey[]): void

    /** Wipe every persisted entry for this collection. */
    deleteAll(): void
}
