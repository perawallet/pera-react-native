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

import {
    getCollections,
    nfdCacheKey,
    type CollectionRegistry,
    type NfdCacheRow as PersistedNfdCacheRow,
} from '@perawallet/wallet-core-database'
import type { NfdName } from '../models'

export type NfdCacheEntry = {
    address: string
    /** null = negative cache (we looked, there's no NFD) */
    name: NfdName | null
}

export type NfdCacheRow = NfdCacheEntry & {
    updatedAt: number
}

function rowToEntry(row: PersistedNfdCacheRow): NfdCacheRow {
    return {
        address: row.address,
        name: row.name
            ? {
                  name: row.name,
                  image: row.image ?? '',
                  source: row.source ?? '',
              }
            : null,
        updatedAt: row.updatedAt,
    }
}

type WithRegistry = { registry?: CollectionRegistry }

function resolveRegistry(registry: CollectionRegistry | undefined): CollectionRegistry {
    return registry ?? getCollections()
}

type UpsertNfdEntriesParams = WithRegistry & {
    network: string
    entries: NfdCacheEntry[]
}

export async function upsertNfdEntries({
    registry,
    network,
    entries,
}: UpsertNfdEntriesParams): Promise<void> {
    if (entries.length === 0) return

    const { nfdCache } = resolveRegistry(registry)
    const now = Date.now()

    nfdCache.upsertMany(
        entries.map<PersistedNfdCacheRow>(entry => ({
            network,
            address: entry.address,
            name: entry.name?.name ?? null,
            image: entry.name?.image ?? null,
            source: entry.name?.source ?? null,
            updatedAt: now,
        })),
    )
}

type GetNfdByAddressParams = WithRegistry & {
    address: string
    network: string
}

export async function getNfdByAddress({
    registry,
    address,
    network,
}: GetNfdByAddressParams): Promise<NfdCacheRow | null> {
    const { nfdCache } = resolveRegistry(registry)
    const row = nfdCache.get(nfdCacheKey({ network, address }))
    return row ? rowToEntry(row) : null
}

type GetNfdsByAddressesParams = WithRegistry & {
    addresses: string[]
    network: string
}

export async function getNfdsByAddresses({
    registry,
    addresses,
    network,
}: GetNfdsByAddressesParams): Promise<NfdCacheRow[]> {
    if (addresses.length === 0) return []

    const { nfdCache } = resolveRegistry(registry)
    const results: NfdCacheRow[] = []
    for (const address of addresses) {
        const row = nfdCache.get(nfdCacheKey({ network, address }))
        if (row !== undefined) results.push(rowToEntry(row))
    }
    return results
}

type GetStaleOrMissingAddressesParams = WithRegistry & {
    addresses: string[]
    network: string
    ttlMs: number
}

/**
 * Given a candidate set of addresses, returns those that are either not
 * in the cache at all or older than `ttlMs`. Used by the syncer to skip
 * work during steady-state polling.
 *
 * Unlike the previous SQL-backed version, this runs entirely in memory:
 * O(addresses.length) map lookups, no allocation beyond the result
 * array. That's faster than the previous query for the common case
 * where the caller hands us a short list (a single account's peers).
 */
export async function getStaleOrMissingAddresses({
    registry,
    addresses,
    network,
    ttlMs,
}: GetStaleOrMissingAddressesParams): Promise<string[]> {
    if (addresses.length === 0) return []

    const { nfdCache } = resolveRegistry(registry)
    const freshThreshold = Date.now() - ttlMs

    return addresses.filter(address => {
        const row = nfdCache.get(nfdCacheKey({ network, address }))
        if (row === undefined) return true
        return row.updatedAt < freshThreshold
    })
}
