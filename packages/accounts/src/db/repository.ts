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

import { eq, and, inArray, notInArray, ne, or, isNull } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import { AssetsPeraSchema, PeraAssetType } from '@perawallet/wallet-core-assets'
import { AccountAssetHoldingsSchema, AccountBalancesSchema } from './schema'

export type HoldingRow = {
    assetId: string
    amount: Decimal
}

type UpsertHoldingInput = {
    assetId: string
    amount: Decimal
}

type UpsertAccountHoldingsParams = {
    db?: Database
    accountAddress: string
    holdings: UpsertHoldingInput[]
    network: string
}

export async function refreshAccountHoldings({
    db = getDatabase(),
    accountAddress,
    holdings,
    network,
}: UpsertAccountHoldingsParams): Promise<void> {
    const now = Date.now()

    await db
        .delete(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
            ),
        )
        .run()

    for (const holding of holdings) {
        await db
            .insert(AccountAssetHoldingsSchema)
            .values({
                accountAddress,
                assetId: new Decimal(holding.assetId),
                network,
                amount: holding.amount,
                updatedAt: now,
            })
            .run()
    }
}

type InsertAssetHoldingParams = {
    db?: Database
    accountAddress: string
    assetId: string
    network: string
    amount?: string
}

export async function insertAssetHolding({
    db = getDatabase(),
    accountAddress,
    assetId,
    network,
    amount,
}: InsertAssetHoldingParams): Promise<void> {
    await db
        .insert(AccountAssetHoldingsSchema)
        .values({
            accountAddress,
            assetId: new Decimal(assetId),
            network,
            amount: new Decimal(amount ?? '0'),
            updatedAt: Date.now(),
        })
        .onConflictDoNothing()
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
    network: string
} & AccountHoldingsFilters

export async function getAccountHoldings({
    db = getDatabase(),
    accountAddress,
    network,
    hideZeroBalance,
    hideNfts,
    hideOptedInNfts,
    excludeAssetTypes,
}: GetAccountHoldingsParams): Promise<HoldingRow[]> {
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
            })
            .from(AccountAssetHoldingsSchema)
            .where(and(...baseConditions))
            .all()

        return rows.map(r => ({
            assetId: r.assetId.toString(),
            amount: r.amount,
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
        assetId: r.assetId.toString(),
        amount: r.amount,
    }))
}

export type AccountBalanceRow = {
    accountAddress: string
    algoBalance: Decimal
    totalAssetsOptedIn: number
    totalCreatedAssets: number
    totalAppsOptedIn: number
    minBalance: Decimal
    status: string
    authAddress: string | null
}

type UpsertAccountBalanceParams = {
    db?: Database
    accountAddress: string
    network: string
    algoBalance: Decimal
    totalAssetsOptedIn: number
    totalCreatedAssets: number
    totalAppsOptedIn: number
    minBalance: Decimal
    status: string
    authAddress: string | null
}

export async function upsertAccountBalance({
    db = getDatabase(),
    accountAddress,
    network,
    algoBalance,
    totalAssetsOptedIn,
    totalCreatedAssets,
    totalAppsOptedIn,
    minBalance,
    status,
    authAddress,
}: UpsertAccountBalanceParams): Promise<void> {
    const now = Date.now()

    await db
        .insert(AccountBalancesSchema)
        .values({
            accountAddress,
            network,
            algoBalance,
            totalAssetsOptedIn,
            totalCreatedAssets,
            totalAppsOptedIn,
            minBalance,
            status,
            authAddress,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [
                AccountBalancesSchema.accountAddress,
                AccountBalancesSchema.network,
            ],
            set: {
                algoBalance,
                totalAssetsOptedIn,
                totalCreatedAssets,
                totalAppsOptedIn,
                minBalance,
                status,
                authAddress,
                updatedAt: now,
            },
        })
        .run()
}

type SeedAuthAddressParams = {
    db?: Database
    accountAddress: string
    network: string
    authAddress: string
}

/**
 * Seed an auth address into the DB without a full on-chain fetch.
 * Used during import when the auth address is already known from
 * discovery. If a row already exists, only the auth_address column
 * is updated; otherwise a minimal placeholder row is inserted so
 * the auth address is available before the background sync fills
 * the rest.
 */
export async function seedAuthAddress({
    db = getDatabase(),
    accountAddress,
    network,
    authAddress,
}: SeedAuthAddressParams): Promise<void> {
    const now = Date.now()

    await db
        .insert(AccountBalancesSchema)
        .values({
            accountAddress,
            network,
            algoBalance: new Decimal(0),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal(0),
            status: 'Offline',
            authAddress,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [
                AccountBalancesSchema.accountAddress,
                AccountBalancesSchema.network,
            ],
            set: {
                authAddress,
                updatedAt: now,
            },
        })
        .run()
}

type GetAccountBalanceParams = {
    db?: Database
    accountAddress: string
    network: string
}

export async function getAccountBalance({
    db = getDatabase(),
    accountAddress,
    network,
}: GetAccountBalanceParams): Promise<AccountBalanceRow | undefined> {
    const rows = await db
        .select({
            accountAddress: AccountBalancesSchema.accountAddress,
            algoBalance: AccountBalancesSchema.algoBalance,
            totalAssetsOptedIn: AccountBalancesSchema.totalAssetsOptedIn,
            totalCreatedAssets: AccountBalancesSchema.totalCreatedAssets,
            totalAppsOptedIn: AccountBalancesSchema.totalAppsOptedIn,
            minBalance: AccountBalancesSchema.minBalance,
            status: AccountBalancesSchema.status,
            authAddress: AccountBalancesSchema.authAddress,
        })
        .from(AccountBalancesSchema)
        .where(
            and(
                eq(AccountBalancesSchema.accountAddress, accountAddress),
                eq(AccountBalancesSchema.network, network),
            ),
        )
        .all()

    return rows[0]
}

type GetAllAccountBalancesParams = {
    db?: Database
    accountAddresses: string[]
    network: string
}

export async function getAllAccountBalances({
    db = getDatabase(),
    accountAddresses,
    network,
}: GetAllAccountBalancesParams): Promise<AccountBalanceRow[]> {
    if (accountAddresses.length === 0) return []

    return db
        .select({
            accountAddress: AccountBalancesSchema.accountAddress,
            algoBalance: AccountBalancesSchema.algoBalance,
            totalAssetsOptedIn: AccountBalancesSchema.totalAssetsOptedIn,
            totalCreatedAssets: AccountBalancesSchema.totalCreatedAssets,
            totalAppsOptedIn: AccountBalancesSchema.totalAppsOptedIn,
            minBalance: AccountBalancesSchema.minBalance,
            status: AccountBalancesSchema.status,
            authAddress: AccountBalancesSchema.authAddress,
        })
        .from(AccountBalancesSchema)
        .where(
            and(
                inArray(AccountBalancesSchema.accountAddress, accountAddresses),
                eq(AccountBalancesSchema.network, network),
            ),
        )
        .all()
}

type DeleteAssetHoldingsParams = {
    db?: Database
    accountAddress: string
    assetIds: string[]
    network: string
}

export async function deleteAssetHoldings({
    db = getDatabase(),
    accountAddress,
    assetIds,
    network,
}: DeleteAssetHoldingsParams): Promise<void> {
    if (assetIds.length === 0) return

    const assetIdDecimals = assetIds.map(id => new Decimal(id))

    await db
        .delete(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
                inArray(AccountAssetHoldingsSchema.assetId, assetIdDecimals),
            ),
        )
        .run()
}

type GetAllHoldingsForNetworkParams = {
    db?: Database
    network: string
}

export async function getAllAssetIdsForNetwork({
    db = getDatabase(),
    network,
}: GetAllHoldingsForNetworkParams): Promise<string[]> {
    const rows = await db
        .selectDistinct({
            assetId: AccountAssetHoldingsSchema.assetId,
        })
        .from(AccountAssetHoldingsSchema)
        .where(eq(AccountAssetHoldingsSchema.network, network))
        .all()

    return rows.map(r => r.assetId.toString())
}
