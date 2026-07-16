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

import { and, eq, gte, inArray } from 'drizzle-orm'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import type { NfdName } from '../models'
import { NfdCacheSchema } from './schema'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type NfdCacheEntry = {
    address: string
    /** null = negative cache (we looked, there's no NFD) */
    name: Nullable<NfdName>
}

export type NfdCacheRow = NfdCacheEntry & {
    updatedAt: number
}

function rowToEntry(row: {
    address: string
    name: Nullable<string>
    image: Nullable<string>
    source: Nullable<string>
    updatedAt: number
}): NfdCacheRow {
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

type UpsertNfdEntriesParams = {
    db?: Database
    network: string
    entries: NfdCacheEntry[]
}

export async function upsertNfdEntries({
    db = getDatabase(),
    network,
    entries,
}: UpsertNfdEntriesParams): Promise<void> {
    if (entries.length === 0) return

    const now = Date.now()

    for (const entry of entries) {
        const values = {
            address: entry.address,
            network,
            name: entry.name?.name ?? null,
            image: entry.name?.image ?? null,
            source: entry.name?.source ?? null,
            updatedAt: now,
        }

        await db
            .insert(NfdCacheSchema)
            .values(values)
            .onConflictDoUpdate({
                target: [NfdCacheSchema.address, NfdCacheSchema.network],
                set: {
                    name: values.name,
                    image: values.image,
                    source: values.source,
                    updatedAt: now,
                },
            })
            .run()
    }
}

type GetNfdByAddressParams = {
    db?: Database
    address: string
    network: string
}

export async function getNfdByAddress({
    db = getDatabase(),
    address,
    network,
}: GetNfdByAddressParams): Promise<Nullable<NfdCacheRow>> {
    const rows = await db
        .select({
            address: NfdCacheSchema.address,
            name: NfdCacheSchema.name,
            image: NfdCacheSchema.image,
            source: NfdCacheSchema.source,
            updatedAt: NfdCacheSchema.updatedAt,
        })
        .from(NfdCacheSchema)
        .where(
            and(
                eq(NfdCacheSchema.address, address),
                eq(NfdCacheSchema.network, network),
            ),
        )
        .all()

    return rows[0] ? rowToEntry(rows[0]) : null
}

type GetNfdsByAddressesParams = {
    db?: Database
    addresses: string[]
    network: string
}

export async function getNfdsByAddresses({
    db = getDatabase(),
    addresses,
    network,
}: GetNfdsByAddressesParams): Promise<NfdCacheRow[]> {
    if (addresses.length === 0) return []

    const rows = await db
        .select({
            address: NfdCacheSchema.address,
            name: NfdCacheSchema.name,
            image: NfdCacheSchema.image,
            source: NfdCacheSchema.source,
            updatedAt: NfdCacheSchema.updatedAt,
        })
        .from(NfdCacheSchema)
        .where(
            and(
                inArray(NfdCacheSchema.address, addresses),
                eq(NfdCacheSchema.network, network),
            ),
        )
        .all()

    return rows.map(rowToEntry)
}

type GetStaleOrMissingAddressesParams = {
    db?: Database
    addresses: string[]
    network: string
    ttlMs: number
}

/**
 * Given a candidate set of addresses, returns those that are either not in
 * the cache at all or older than `ttlMs`. Used by the syncer to skip work
 * during steady-state polling.
 *
 * The freshness predicate is pushed into SQL so we only round-trip the
 * matching addresses, not every cached row.
 */
export async function getStaleOrMissingAddresses({
    db = getDatabase(),
    addresses,
    network,
    ttlMs,
}: GetStaleOrMissingAddressesParams): Promise<string[]> {
    if (addresses.length === 0) return []

    const freshThreshold = Date.now() - ttlMs

    const freshRows = await db
        .select({ address: NfdCacheSchema.address })
        .from(NfdCacheSchema)
        .where(
            and(
                inArray(NfdCacheSchema.address, addresses),
                eq(NfdCacheSchema.network, network),
                gte(NfdCacheSchema.updatedAt, freshThreshold),
            ),
        )
        .all()

    const freshSet = new Set(freshRows.map(row => row.address))
    return addresses.filter(addr => !freshSet.has(addr))
}
