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

import {
    eq,
    and,
    inArray,
    gte,
    like,
    lt,
    ne,
    or,
    isNull,
    sql,
    type SQL,
} from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { Decimal } from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import type { Optional } from '@perawallet/wallet-core-shared'
import { PeraAssetType } from '../models'
import { hasNftShape } from '../utils'
import {
    AssetsNodeSchema,
    AssetsPeraSchema,
    AssetPricesSchema,
    AssetPriceMissesSchema,
} from './schema'

type GetStaleOrMissingAssetIdsParams = {
    db?: Database
    assetIds: string[]
    network: string
    ttlMs: number
}

/**
 * Above this, the id predicate moves out of SQL: a parameter-per-id query
 * dies at SQLITE_MAX_VARIABLE_NUMBER and costs seconds of JS in query
 * build/bind below it on a 10k-asset wallet. A network-scoped
 * scan returning one column bridges in tens of milliseconds instead; the
 * id filter happens here against a Set.
 */
const ID_PREDICATE_IN_SQL_MAX = 64

/**
 * Id filter for a candidate set, or `undefined` past the cap — callers must
 * then re-filter the rows in JS. See ID_PREDICATE_IN_SQL_MAX.
 */
const idPredicate = (
    column: AnySQLiteColumn,
    assetIds: string[],
): Optional<SQL> =>
    assetIds.length <= ID_PREDICATE_IN_SQL_MAX
        ? inArray(
              column,
              assetIds.map(id => new Decimal(id)),
          )
        : undefined

/**
 * Shared freshness scan over any table carrying `assetId`/`network`/
 * `updatedAt` columns. Small candidate sets push the id predicate into SQL;
 * large ones fetch the network's fresh ids and diff in JS — see
 * ID_PREDICATE_IN_SQL_MAX.
 */
async function getStaleOrMissingIdsFromTable({
    db,
    table,
    assetIds,
    network,
    ttlMs,
}: Required<GetStaleOrMissingAssetIdsParams> & {
    table: typeof AssetsNodeSchema | typeof AssetPricesSchema
}): Promise<string[]> {
    if (assetIds.length === 0) return []

    const freshThreshold = Date.now() - ttlMs

    const freshRows = await db
        // Raw TEXT read: routing through the column's Decimal decoder would
        // cost one Decimal + one toString per row for ids we only compare.
        .select({ assetId: sql<string>`${table.assetId}` })
        .from(table)
        .where(
            and(
                eq(table.network, network),
                gte(table.updatedAt, freshThreshold),
                idPredicate(table.assetId, assetIds),
            ),
        )
        .all()

    const freshSet = new Set(freshRows.map(r => r.assetId))
    return assetIds.filter(id => !freshSet.has(id))
}

export type UnclassifiedRecheck = {
    /** How often an unclassified asset is re-asked about. */
    ttlMs: number
    /** How long it stays eligible, measured from `first_seen_at`. */
    windowMs: number
}

/**
 * NFT-shaped assets, seen recently, that the backend has not typed as a
 * collectible yet.
 *
 * The backend only flips the type once its crawler has fetched the asset's
 * media, which lands seconds to hours after a mint — caching that first
 * answer for the whole of `ASSET_CACHE_TTL_MS` is what stranded minted NFTs
 * in the tokens tab for a week. The shape filter is what keeps a
 * wallet full of fungible tokens from re-asking about all of them.
 */
async function getUnclassifiedNftIds({
    db,
    assetIds,
    network,
    ttlMs,
    windowMs,
}: {
    db: Database
    assetIds: string[]
    network: string
} & UnclassifiedRecheck): Promise<string[]> {
    const now = Date.now()

    const rows = await db
        .select({
            assetId: sql<string>`${AssetsPeraSchema.assetId}`,
            totalSupply: AssetsNodeSchema.totalSupply,
            decimals: AssetsNodeSchema.decimals,
        })
        .from(AssetsPeraSchema)
        .innerJoin(
            AssetsNodeSchema,
            and(
                eq(AssetsPeraSchema.assetId, AssetsNodeSchema.assetId),
                eq(AssetsPeraSchema.network, AssetsNodeSchema.network),
            ),
        )
        .where(
            and(
                eq(AssetsPeraSchema.network, network),
                // NULL on rows cached before the column, which reads as "not
                // newly seen" and keeps them on the long TTL.
                gte(AssetsPeraSchema.firstSeenAt, now - windowMs),
                lt(AssetsPeraSchema.updatedAt, now - ttlMs),
                or(
                    isNull(AssetsPeraSchema.assetType),
                    ne(AssetsPeraSchema.assetType, PeraAssetType.collectible),
                ),
                idPredicate(AssetsPeraSchema.assetId, assetIds),
            ),
        )
        .all()

    const candidates = new Set(assetIds)
    return rows
        .filter(row => candidates.has(row.assetId) && hasNftShape(row))
        .map(row => row.assetId)
}

export type Arc19Recheck = {
    /** How often a held ARC19 collectible is re-fetched. */
    ttlMs: number
}

/**
 * Held ARC19 collectibles whose pera-half row has outlived `ttlMs`.
 *
 * ARC19 media is mutable: the manager's acfg re-points the reserve address at
 * a new CID and the backend re-crawls to a new media URL, but only a re-fetch
 * of the assets_pera row picks that URL up — the long ASSET_CACHE_TTL_MS kept
 * the pre-update image on screen for up to a week.
 *
 * Keyed on the PERA half's updatedAt: the detail screen persists through
 * upsertNodeAssets, which bumps the node half's timestamp (the one the main
 * gate reads) without refreshing media — a regularly viewed NFT would
 * otherwise never re-qualify.
 */
async function getStaleArc19CollectibleIds({
    db,
    assetIds,
    network,
    ttlMs,
}: {
    db: Database
    assetIds: string[]
    network: string
} & Arc19Recheck): Promise<string[]> {
    const now = Date.now()

    const rows = await db
        .select({ assetId: sql<string>`${AssetsPeraSchema.assetId}` })
        .from(AssetsPeraSchema)
        .innerJoin(
            AssetsNodeSchema,
            and(
                eq(AssetsPeraSchema.assetId, AssetsNodeSchema.assetId),
                eq(AssetsPeraSchema.network, AssetsNodeSchema.network),
            ),
        )
        .where(
            and(
                eq(AssetsPeraSchema.network, network),
                eq(AssetsPeraSchema.assetType, PeraAssetType.collectible),
                like(AssetsNodeSchema.url, 'template-ipfs://%'),
                lt(AssetsPeraSchema.updatedAt, now - ttlMs),
                idPredicate(AssetsPeraSchema.assetId, assetIds),
            ),
        )
        .all()

    const candidates = new Set(assetIds)
    return rows.map(row => row.assetId).filter(id => candidates.has(id))
}

/**
 * Held collectibles whose `assets_node.url` was never resolved.
 *
 * The bulk /v2/assets/ serializer carries no url field, so rows synced
 * through it can't be recognized as ARC19 until the indexer is asked once.
 * NULL means "never asked"; the backfill writes '' for a chain-confirmed
 * absent url, so those are never re-asked.
 */
export async function getCollectibleIdsMissingUrl({
    db = getDatabase(),
    assetIds,
    network,
    limit,
}: {
    db?: Database
    assetIds: string[]
    network: string
    /** Bounds one backfill pass; the remainder converges on later passes. */
    limit?: number
}): Promise<string[]> {
    if (assetIds.length === 0) return []

    const query = db
        .select({ assetId: sql<string>`${AssetsPeraSchema.assetId}` })
        .from(AssetsPeraSchema)
        .innerJoin(
            AssetsNodeSchema,
            and(
                eq(AssetsPeraSchema.assetId, AssetsNodeSchema.assetId),
                eq(AssetsPeraSchema.network, AssetsNodeSchema.network),
            ),
        )
        .where(
            and(
                eq(AssetsPeraSchema.network, network),
                eq(AssetsPeraSchema.assetType, PeraAssetType.collectible),
                isNull(AssetsNodeSchema.url),
                idPredicate(AssetsPeraSchema.assetId, assetIds),
            ),
        )

    const rows = await (limit === undefined ? query : query.limit(limit)).all()

    const candidates = new Set(assetIds)
    return rows.map(row => row.assetId).filter(id => candidates.has(id))
}

/**
 * Given a candidate set of asset IDs, returns those that are either not in
 * the DB at all or older than `ttlMs`. Used by the syncer to skip work
 * during steady-state polling.
 *
 * `recheckUnclassified` additionally returns assets still awaiting
 * classification — see `getUnclassifiedNftIds`. `recheckArc19` additionally
 * returns ARC19 collectibles due a media re-fetch — see
 * `getStaleArc19CollectibleIds`.
 */
export async function getStaleOrMissingAssetIds({
    db = getDatabase(),
    recheckUnclassified,
    recheckArc19,
    ...params
}: GetStaleOrMissingAssetIdsParams & {
    recheckUnclassified?: UnclassifiedRecheck
    recheckArc19?: Arc19Recheck
}): Promise<string[]> {
    const staleOrMissing = await getStaleOrMissingIdsFromTable({
        db,
        table: AssetsNodeSchema,
        ...params,
    })

    const unclassified = recheckUnclassified
        ? await getUnclassifiedNftIds({
              db,
              assetIds: params.assetIds,
              network: params.network,
              ...recheckUnclassified,
          })
        : []

    const arc19 = recheckArc19
        ? await getStaleArc19CollectibleIds({
              db,
              assetIds: params.assetIds,
              network: params.network,
              ...recheckArc19,
          })
        : []

    return unclassified.length === 0 && arc19.length === 0
        ? staleOrMissing
        : [...new Set([...staleOrMissing, ...unclassified, ...arc19])]
}

type GetStaleOrMissingPriceAssetIdsParams = GetStaleOrMissingAssetIdsParams & {
    /**
     * When set, ids whose last recorded price miss is younger than this are
     * excluded too — "known priceless" retries on this slower cadence instead
     * of every pass.
     */
    missRetryMs?: number
}

/**
 * Price-row counterpart of `getStaleOrMissingAssetIds`: returns the asset IDs
 * whose price row on `network` is absent or older than `ttlMs`. Lets the
 * price syncer skip refetches when overlapping sync/enrichment paths run
 * within the TTL window.
 */
export async function getStaleOrMissingPriceAssetIds({
    db = getDatabase(),
    missRetryMs,
    ...params
}: GetStaleOrMissingPriceAssetIdsParams): Promise<string[]> {
    const staleOrMissing = await getStaleOrMissingIdsFromTable({
        db,
        table: AssetPricesSchema,
        ...params,
    })
    if (missRetryMs === undefined || staleOrMissing.length === 0) {
        return staleOrMissing
    }

    const retryThreshold = Date.now() - missRetryMs
    const conditions = [
        eq(AssetPriceMissesSchema.network, params.network),
        gte(AssetPriceMissesSchema.attemptedAt, retryThreshold),
    ]
    // Same split as getStaleOrMissingIdsFromTable: past the cap, scanning the
    // network's recent misses beats binding one parameter per candidate id.
    if (staleOrMissing.length <= ID_PREDICATE_IN_SQL_MAX) {
        conditions.push(
            inArray(
                AssetPriceMissesSchema.assetId,
                staleOrMissing.map(id => new Decimal(id)),
            ),
        )
    }

    const deferredRows = await db
        .select({ assetId: sql<string>`${AssetPriceMissesSchema.assetId}` })
        .from(AssetPriceMissesSchema)
        .where(and(...conditions))
        .all()

    const deferredSet = new Set(deferredRows.map(r => r.assetId))
    return staleOrMissing.filter(id => !deferredSet.has(id))
}
