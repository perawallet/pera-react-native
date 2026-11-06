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
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { AddressName } from '../models'
import { NameCacheSchema } from './schema'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type NameCacheEntry = {
    address: string
    /** null = negative cache (we looked, there's no name) */
    name: Nullable<AddressName>
}

export type NameCacheRow = NameCacheEntry & {
    updatedAt: number
}

function rowToEntry(row: {
    address: string
    name: Nullable<string>
    image: Nullable<string>
    source: Nullable<string>
    updatedAt: number
}): NameCacheRow {
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

type UpsertNameEntriesParams = {
    db?: Database
    scope: ChainScope
    entries: NameCacheEntry[]
}

export async function upsertNameEntries({
    db = getDatabase(),
    scope,
    entries,
}: UpsertNameEntriesParams): Promise<void> {
    const scopeKey = toScopeKey(scope)
    if (entries.length === 0) return

    const now = Date.now()

    for (const entry of entries) {
        const values = {
            address: entry.address,
            scope: scopeKey,
            name: entry.name?.name ?? null,
            image: entry.name?.image ?? null,
            source: entry.name?.source ?? null,
            updatedAt: now,
        }

        await db
            .insert(NameCacheSchema)
            .values(values)
            .onConflictDoUpdate({
                target: [NameCacheSchema.address, NameCacheSchema.scope],
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

type GetNameByAddressParams = {
    db?: Database
    address: string
    scope: ChainScope
}

export async function getNameByAddress({
    db = getDatabase(),
    address,
    scope,
}: GetNameByAddressParams): Promise<Nullable<NameCacheRow>> {
    const scopeKey = toScopeKey(scope)
    const rows = await db
        .select({
            address: NameCacheSchema.address,
            name: NameCacheSchema.name,
            image: NameCacheSchema.image,
            source: NameCacheSchema.source,
            updatedAt: NameCacheSchema.updatedAt,
        })
        .from(NameCacheSchema)
        .where(
            and(
                eq(NameCacheSchema.address, address),
                eq(NameCacheSchema.scope, scopeKey),
            ),
        )
        .all()

    return rows[0] ? rowToEntry(rows[0]) : null
}

type GetNamesByAddressesParams = {
    db?: Database
    addresses: string[]
    scope: ChainScope
}

export async function getNamesByAddresses({
    db = getDatabase(),
    addresses,
    scope,
}: GetNamesByAddressesParams): Promise<NameCacheRow[]> {
    const scopeKey = toScopeKey(scope)
    if (addresses.length === 0) return []

    const rows = await db
        .select({
            address: NameCacheSchema.address,
            name: NameCacheSchema.name,
            image: NameCacheSchema.image,
            source: NameCacheSchema.source,
            updatedAt: NameCacheSchema.updatedAt,
        })
        .from(NameCacheSchema)
        .where(
            and(
                inArray(NameCacheSchema.address, addresses),
                eq(NameCacheSchema.scope, scopeKey),
            ),
        )
        .all()

    return rows.map(rowToEntry)
}

type GetStaleOrMissingAddressesParams = {
    db?: Database
    addresses: string[]
    scope: ChainScope
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
    scope,
    ttlMs,
}: GetStaleOrMissingAddressesParams): Promise<string[]> {
    const scopeKey = toScopeKey(scope)
    if (addresses.length === 0) return []

    const freshThreshold = Date.now() - ttlMs

    const freshRows = await db
        .select({ address: NameCacheSchema.address })
        .from(NameCacheSchema)
        .where(
            and(
                inArray(NameCacheSchema.address, addresses),
                eq(NameCacheSchema.scope, scopeKey),
                gte(NameCacheSchema.updatedAt, freshThreshold),
            ),
        )
        .all()

    const freshSet = new Set(freshRows.map(row => row.address))
    return addresses.filter(addr => !freshSet.has(addr))
}
