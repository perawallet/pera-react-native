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

import { eq, and, inArray, notInArray } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import { AssetsPeraSchema } from '@perawallet/wallet-core-assets'
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

type GetAccountHoldingsParams = {
    db?: Database
    accountAddress: string
    network: string
    excludeAssetTypes?: string[]
}

export async function getAccountHoldings({
    db = getDatabase(),
    accountAddress,
    network,
    excludeAssetTypes,
}: GetAccountHoldingsParams): Promise<HoldingRow[]> {
    if (!excludeAssetTypes?.length) {
        const rows = await db
            .select({
                assetId: AccountAssetHoldingsSchema.assetId,
                amount: AccountAssetHoldingsSchema.amount,
            })
            .from(AccountAssetHoldingsSchema)
            .where(
                and(
                    eq(
                        AccountAssetHoldingsSchema.accountAddress,
                        accountAddress,
                    ),
                    eq(AccountAssetHoldingsSchema.network, network),
                ),
            )
            .all()

        return rows.map(r => ({
            assetId: r.assetId.toString(),
            amount: r.amount,
        }))
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
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
                notInArray(AssetsPeraSchema.assetType, excludeAssetTypes),
            ),
        )
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
