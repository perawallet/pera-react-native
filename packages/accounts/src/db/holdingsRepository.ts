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

import { eq, and, inArray, notInArray, ne, or, isNull, sql } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    forEachWriteChunk,
    getDatabase,
    type Database,
} from '@perawallet/wallet-core-database'
import { AssetsPeraSchema, PeraAssetType } from '@perawallet/wallet-core-assets'
import { AccountAssetHoldingsSchema } from './schema'

export type HoldingRow = {
    assetId: string
    amount: Decimal
    /** Holding-level freeze from algod — frozen assets can't be transferred. */
    isFrozen: boolean
}

type UpsertHoldingInput = {
    assetId: string
    amount: Decimal
    /** Holding-level freeze from algod. Defaults to false when omitted. */
    isFrozen?: boolean
}

type UpsertAccountHoldingsParams = {
    db?: Database
    accountAddress: string
    holdings: UpsertHoldingInput[]
    scope: ChainScope
}

/**
 * Writes only the delta, returning whether anything changed so the sync service
 * can skip downstream work. Diffing (rather than delete-all + per-row insert)
 * means an unchanged account does zero writes — that loop cost thousands of
 * serialized round-trips through the single SQLite connection every tick.
 */
export async function refreshAccountHoldings({
    db = getDatabase(),
    accountAddress,
    holdings,
    scope,
}: UpsertAccountHoldingsParams): Promise<boolean> {
    const network = toScopeKey(scope)
    const now = Date.now()

    const existingRows = await db
        .select({
            assetId: AccountAssetHoldingsSchema.assetId,
            amount: AccountAssetHoldingsSchema.amount,
            isFrozen: AccountAssetHoldingsSchema.isFrozen,
        })
        .from(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
            ),
        )
        .all()

    const existing = new Map(
        existingRows.map(r => [
            r.assetId,
            { amount: r.amount, isFrozen: r.isFrozen },
        ]),
    )
    const incomingIds = new Set(holdings.map(h => h.assetId))

    // Compare canonical string forms — robust whether the incoming amount is a
    // Decimal (production) or another numeric type (some tests), and the DB
    // value always round-trips through Decimal#toString.
    const changed = holdings.filter(h => {
        const prev = existing.get(h.assetId)
        return (
            prev === undefined ||
            prev.amount.toString() !== String(h.amount) ||
            prev.isFrozen !== (h.isFrozen ?? false)
        )
    })
    const removed = [...existing.keys()].filter(id => !incomingIds.has(id))

    if (changed.length === 0 && removed.length === 0) return false

    if (removed.length > 0) {
        await forEachWriteChunk(removed, async chunk => {
            await db
                .delete(AccountAssetHoldingsSchema)
                .where(
                    and(
                        eq(
                            AccountAssetHoldingsSchema.accountAddress,
                            accountAddress,
                        ),
                        eq(AccountAssetHoldingsSchema.network, network),
                        inArray(AccountAssetHoldingsSchema.assetId, chunk),
                    ),
                )
                .run()
        })
    }

    if (changed.length > 0) {
        const rows = changed.map(h => ({
            accountAddress,
            assetId: h.assetId,
            network,
            amount: h.amount,
            isFrozen: h.isFrozen ?? false,
            updatedAt: now,
        }))
        await forEachWriteChunk(rows, async chunk => {
            await db
                .insert(AccountAssetHoldingsSchema)
                .values(chunk)
                .onConflictDoUpdate({
                    target: [
                        AccountAssetHoldingsSchema.accountAddress,
                        AccountAssetHoldingsSchema.assetId,
                        AccountAssetHoldingsSchema.network,
                    ],
                    set: {
                        amount: sql`excluded.amount`,
                        isFrozen: sql`excluded.is_frozen`,
                        updatedAt: sql`excluded.updated_at`,
                    },
                })
                .run()
        })
    }

    return true
}

type InsertAssetHoldingParams = {
    db?: Database
    accountAddress: string
    assetId: string
    scope: ChainScope
    amount?: string
    isFrozen?: boolean
}

export async function insertAssetHolding({
    db = getDatabase(),
    accountAddress,
    assetId,
    scope,
    amount,
    isFrozen,
}: InsertAssetHoldingParams): Promise<void> {
    const network = toScopeKey(scope)
    await db
        .insert(AccountAssetHoldingsSchema)
        .values({
            accountAddress,
            assetId,
            network,
            amount: new Decimal(amount ?? '0'),
            isFrozen: isFrozen ?? false,
            updatedAt: Date.now(),
        })
        .onConflictDoNothing()
        .run()
}

type AddToAssetHoldingParams = {
    db?: Database
    accountAddress: string
    assetId: string
    scope: ChainScope
    /** Amount to credit, in base units. */
    amount: Decimal
}

/**
 * Surfaces the expected post-transaction balance before the chain reflects it.
 * Can't stick around wrong: the next sync's full diff replaces the row with
 * chain truth. The read-modify-write is safe on the single serialized
 * connection.
 */
export async function addToAssetHolding({
    db = getDatabase(),
    accountAddress,
    assetId,
    scope,
    amount,
}: AddToAssetHoldingParams): Promise<void> {
    const network = toScopeKey(scope)
    const conditions = and(
        eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
        eq(AccountAssetHoldingsSchema.network, network),
        eq(AccountAssetHoldingsSchema.assetId, assetId),
    )

    const existing = await db
        .select({ amount: AccountAssetHoldingsSchema.amount })
        .from(AccountAssetHoldingsSchema)
        .where(conditions)
        .all()

    const prior = existing[0]?.amount
    if (prior === undefined) {
        await insertAssetHolding({
            db,
            accountAddress,
            assetId,
            scope,
            amount: amount.toString(),
        })
        return
    }

    await db
        .update(AccountAssetHoldingsSchema)
        .set({ amount: prior.plus(amount), updatedAt: Date.now() })
        .where(conditions)
        .run()
}

export type AccountHoldingsFilters = {
    /** When true, rows with amount === 0 are excluded. */
    hideZeroBalance?: boolean
    /** When true, NFTs (collectible asset type) are excluded entirely. */
    hideNfts?: boolean
    /** When true, NFTs that are opted-in but have a zero balance are excluded. */
    hideOptedInNfts?: boolean
    /** Asset types to exclude regardless of holding amount. */
    excludeAssetTypes?: string[]
}

type GetAccountHoldingsParams = {
    db?: Database
    accountAddress: string
    scope: ChainScope
} & AccountHoldingsFilters

export async function getAccountHoldings({
    db = getDatabase(),
    accountAddress,
    scope,
    hideZeroBalance,
    hideNfts,
    hideOptedInNfts,
    excludeAssetTypes,
}: GetAccountHoldingsParams): Promise<HoldingRow[]> {
    const network = toScopeKey(scope)
    const needsAssetJoin =
        hideNfts === true ||
        hideOptedInNfts === true ||
        !!excludeAssetTypes?.length

    const baseConditions = [
        eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
        eq(AccountAssetHoldingsSchema.network, network),
    ]

    if (hideZeroBalance) {
        // Decimal columns are stored as TEXT and normalized via Decimal#toString,
        // so a zero amount is always the literal "0".
        baseConditions.push(
            ne(AccountAssetHoldingsSchema.amount, new Decimal(0)),
        )
    }

    if (!needsAssetJoin) {
        const rows = await db
            .select({
                assetId: AccountAssetHoldingsSchema.assetId,
                amount: AccountAssetHoldingsSchema.amount,
                isFrozen: AccountAssetHoldingsSchema.isFrozen,
            })
            .from(AccountAssetHoldingsSchema)
            .where(and(...baseConditions))
            .all()

        return rows.map(r => ({
            assetId: r.assetId,
            amount: r.amount,
            isFrozen: r.isFrozen,
        }))
    }

    const joinConditions = [...baseConditions]

    if (hideNfts) {
        // Exclude any holding whose asset type is collectible. Unknown
        // (NULL) asset types are kept since we can't yet classify them.
        joinConditions.push(
            or(
                isNull(AssetsPeraSchema.assetType),
                ne(AssetsPeraSchema.assetType, PeraAssetType.collectible),
            )!,
        )
    } else if (hideOptedInNfts) {
        // Keep all non-NFT holdings, plus NFT holdings with a non-zero balance.
        joinConditions.push(
            or(
                isNull(AssetsPeraSchema.assetType),
                ne(AssetsPeraSchema.assetType, PeraAssetType.collectible),
                ne(AccountAssetHoldingsSchema.amount, new Decimal(0)),
            )!,
        )
    }

    if (excludeAssetTypes?.length) {
        joinConditions.push(
            or(
                isNull(AssetsPeraSchema.assetType),
                notInArray(AssetsPeraSchema.assetType, excludeAssetTypes),
            )!,
        )
    }

    const rows = await db
        .select({
            assetId: AccountAssetHoldingsSchema.assetId,
            amount: AccountAssetHoldingsSchema.amount,
            isFrozen: AccountAssetHoldingsSchema.isFrozen,
        })
        .from(AccountAssetHoldingsSchema)
        .leftJoin(
            AssetsPeraSchema,
            and(
                eq(
                    AccountAssetHoldingsSchema.assetId,
                    AssetsPeraSchema.assetId,
                ),
                eq(
                    AccountAssetHoldingsSchema.network,
                    AssetsPeraSchema.network,
                ),
            ),
        )
        .where(and(...joinConditions))
        .all()

    return rows.map(r => ({
        assetId: r.assetId,
        amount: r.amount,
        isFrozen: r.isFrozen,
    }))
}

type IsAssetFrozenParams = {
    db?: Database
    accountAddress: string
    assetId: string
    scope: ChainScope
}

/**
 * Whether this account's holding of `assetId` is frozen. A frozen holding can
 * neither send nor receive, so send and swap both gate on this before building.
 *
 * Reads the same SQLite row the balance queries do — no request — and hits the
 * (account_address, asset_id, network) primary key, so it's a point lookup
 * rather than a scan of every holding the account has. An account that doesn't
 * hold the asset has no row, and nothing to be frozen.
 */
export async function isAssetFrozen({
    db = getDatabase(),
    accountAddress,
    assetId,
    scope,
}: IsAssetFrozenParams): Promise<boolean> {
    const network = toScopeKey(scope)
    const rows = await db
        .select({ isFrozen: AccountAssetHoldingsSchema.isFrozen })
        .from(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
                eq(AccountAssetHoldingsSchema.assetId, assetId),
            ),
        )
        .all()

    return rows[0]?.isFrozen === true
}

type DeleteAssetHoldingsParams = {
    db?: Database
    accountAddress: string
    assetIds: string[]
    scope: ChainScope
}

export async function deleteAssetHoldings({
    db = getDatabase(),
    accountAddress,
    assetIds,
    scope,
}: DeleteAssetHoldingsParams): Promise<void> {
    const network = toScopeKey(scope)
    if (assetIds.length === 0) return

    await db
        .delete(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
                inArray(AccountAssetHoldingsSchema.assetId, assetIds),
            ),
        )
        .run()
}

type GetAllHeldAssetIdsForNetworkParams = {
    db?: Database
    scope: ChainScope
}

export async function getAllHeldAssetIdsForNetwork({
    db = getDatabase(),
    scope,
}: GetAllHeldAssetIdsForNetworkParams): Promise<string[]> {
    const network = toScopeKey(scope)
    const rows = await db
        .selectDistinct({
            assetId: AccountAssetHoldingsSchema.assetId,
        })
        .from(AccountAssetHoldingsSchema)
        .where(eq(AccountAssetHoldingsSchema.network, network))
        // Stable order matters: the price syncer slices this list into fixed
        // batches, so an unspecified DISTINCT order re-shuffles batch
        // membership between sync ticks.
        .orderBy(AccountAssetHoldingsSchema.assetId)
        .all()

    return rows.map(r => r.assetId)
}

type GetAssetHolderAddressesParams = {
    db?: Database
    assetId: string
    scope: ChainScope
}

/**
 * Addresses of the user's accounts that hold, or are opted into, `assetId` on
 * `network` — owners (non-zero amount) first, then opted-in-with-zero rows, and
 * by address within each group so repeated lookups agree on the same account.
 */
export async function getAssetHolderAddresses({
    db = getDatabase(),
    assetId,
    scope,
}: GetAssetHolderAddressesParams): Promise<string[]> {
    const network = toScopeKey(scope)
    const rows = await db
        .select({
            accountAddress: AccountAssetHoldingsSchema.accountAddress,
            amount: AccountAssetHoldingsSchema.amount,
        })
        .from(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.assetId, assetId),
                eq(AccountAssetHoldingsSchema.network, network),
            ),
        )
        .orderBy(AccountAssetHoldingsSchema.accountAddress)
        .all()

    const owned: string[] = []
    const optedIn: string[] = []
    for (const row of rows) {
        if (row.amount.greaterThan(0)) {
            owned.push(row.accountAddress)
        } else {
            optedIn.push(row.accountAddress)
        }
    }

    return [...owned, ...optedIn]
}

export type HeldAssetRef = {
    assetId: string
    network: string
}

type GetHeldAssetIdsByAccountParams = {
    db?: Database
    accountAddress: string
}

/** All (assetId, network) pairs the account holds or is opted into, across every network. */
export async function getHeldAssetIdsByAccount({
    db = getDatabase(),
    accountAddress,
}: GetHeldAssetIdsByAccountParams): Promise<HeldAssetRef[]> {
    const rows = await db
        .selectDistinct({
            assetId: AccountAssetHoldingsSchema.assetId,
            network: AccountAssetHoldingsSchema.network,
        })
        .from(AccountAssetHoldingsSchema)
        .where(eq(AccountAssetHoldingsSchema.accountAddress, accountAddress))
        .all()

    return rows.map(r => ({
        assetId: r.assetId,
        network: r.network,
    }))
}

type DeleteAllAssetHoldingsForAccountParams = {
    db?: Database
    accountAddress: string
}

/** Deletes every holdings row for an account, across all networks. */
export async function deleteAllAssetHoldingsForAccount({
    db = getDatabase(),
    accountAddress,
}: DeleteAllAssetHoldingsForAccountParams): Promise<void> {
    await db
        .delete(AccountAssetHoldingsSchema)
        .where(eq(AccountAssetHoldingsSchema.accountAddress, accountAddress))
        .run()
}
