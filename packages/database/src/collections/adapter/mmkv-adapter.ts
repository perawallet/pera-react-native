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
 * Per-collection MMKV key namespace:
 *
 *     tdb:<collection>:<schemaVersion>:<key>   → serialized JSON value
 *     tdb_version:<collection>                 → number (last seen schemaVersion)
 *
 * The `tdb` (TanStack DB) prefix keeps us disjoint from Zustand's persist
 * keys and any other future MMKV consumers. The schema version is baked
 * into the value key so a bump naturally orphans the old keys, which we
 * then sweep in `reconcileSchemaVersion`.
 */
const KEY_PREFIX = 'tdb'
const VERSION_KEY_PREFIX = 'tdb_version'

const SEPARATOR = ':'

function dataKey(name: string, version: number, key: CollectionKey): string {
    return `${KEY_PREFIX}${SEPARATOR}${name}${SEPARATOR}${version}${SEPARATOR}${key}`
}

function dataKeyPrefix(name: string, version: number): string {
    return `${KEY_PREFIX}${SEPARATOR}${name}${SEPARATOR}${version}${SEPARATOR}`
}

function collectionKeyPrefix(name: string): string {
    return `${KEY_PREFIX}${SEPARATOR}${name}${SEPARATOR}`
}

function versionKey(name: string): string {
    return `${VERSION_KEY_PREFIX}${SEPARATOR}${name}`
}

function parseDataKey(
    name: string,
    version: number,
    storedKey: string,
): CollectionKey | null {
    const prefix = dataKeyPrefix(name, version)
    if (!storedKey.startsWith(prefix)) return null
    return storedKey.slice(prefix.length)
}

export type MmkvAdapterOptions = {
    name: string
    schemaVersion: number
    mmkv: MmkvLike
}

export class MmkvAdapter<TValue> implements PersistentAdapter<TValue> {
    readonly name: string
    readonly schemaVersion: number
    private readonly mmkv: MmkvLike

    constructor({ name, schemaVersion, mmkv }: MmkvAdapterOptions) {
        this.name = name
        this.schemaVersion = schemaVersion
        this.mmkv = mmkv
        this.reconcileSchemaVersion()
    }

    hydrate(): Map<CollectionKey, TValue> {
        const out = new Map<CollectionKey, TValue>()
        const storedKeys = this.mmkv.getAllKeys()
        for (const storedKey of storedKeys) {
            const key = parseDataKey(this.name, this.schemaVersion, storedKey)
            if (key === null) continue

            const serialized = this.mmkv.getString(storedKey)
            if (serialized === undefined) continue

            try {
                out.set(key, decode<TValue>(serialized))
            } catch (err) {
                // Per-entry try/catch: never crash bootstrap on a single
                // corrupt row. Drop the offending key so it does not keep
                // failing on every hydrate.
                this.mmkv.delete(storedKey)
                logHydrationFailure(this.name, key, err)
            }
        }
        return out
    }

    put(key: CollectionKey, value: TValue): void {
        this.mmkv.set(
            dataKey(this.name, this.schemaVersion, key),
            encode(value),
        )
    }

    putMany(
        entries: ReadonlyArray<readonly [CollectionKey, TValue]>,
    ): void {
        for (const [key, value] of entries) {
            this.put(key, value)
        }
    }

    delete(key: CollectionKey): void {
        this.mmkv.delete(dataKey(this.name, this.schemaVersion, key))
    }

    deleteMany(keys: readonly CollectionKey[]): void {
        for (const key of keys) {
            this.delete(key)
        }
    }

    deleteAll(): void {
        const prefix = collectionKeyPrefix(this.name)
        const storedKeys = this.mmkv.getAllKeys()
        for (const storedKey of storedKeys) {
            if (storedKey.startsWith(prefix)) {
                this.mmkv.delete(storedKey)
            }
        }
    }

    /**
     * Compare the stored schemaVersion to the version this adapter was
     * constructed with. If they differ (or there is no stored version),
     * wipe every entry for this collection — persisted rows are always
     * derivable from the network, so drop-and-rebuild is the safe and
     * simple replacement for formal migrations.
     */
    private reconcileSchemaVersion(): void {
        const key = versionKey(this.name)
        const stored = this.mmkv.getString(key)
        const storedVersion = stored === undefined ? null : Number(stored)
        if (storedVersion === this.schemaVersion) return

        // Wipe every entry for this collection, regardless of schemaVersion
        // encoded in the key — we don't want orphaned old-version rows
        // lingering forever.
        const prefix = collectionKeyPrefix(this.name)
        for (const storedKey of this.mmkv.getAllKeys()) {
            if (storedKey.startsWith(prefix)) {
                this.mmkv.delete(storedKey)
            }
        }
        this.mmkv.set(key, String(this.schemaVersion))
    }
}

function logHydrationFailure(
    collection: string,
    key: CollectionKey,
    err: unknown,
): void {
    // eslint-disable-next-line no-console
    console.warn(
        `[collections] Dropping corrupt row during hydrate: collection=${collection} key=${key}`,
        err,
    )
}
