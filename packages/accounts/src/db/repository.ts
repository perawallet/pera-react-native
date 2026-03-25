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

import { eq, and, inArray } from 'drizzle-orm'
import {
    getDatabase,
    type DrizzleDatabase,
} from '@perawallet/wallet-core-database'
import { AccountAssetHoldingsSchema, AccountBalancesSchema } from './schema'

export type HoldingRow = {
    assetId: string
    amount: string
}

type UpsertAccountHoldingsParams = {
    db?: DrizzleDatabase
    accountAddress: string
    holdings: HoldingRow[]
    network: string
}

export function upsertAccountHoldings({
    db = getDatabase(),
    accountAddress,
    holdings,
    network,
}: UpsertAccountHoldingsParams): void {
    const now = Date.now()

    db.delete(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
            ),
        )
        .run()

    for (const holding of holdings) {
        db.insert(AccountAssetHoldingsSchema)
            .values({
                accountAddress,
                assetId: holding.assetId,
                network,
                amount: holding.amount,
                updatedAt: now,
            })
            .run()
    }
}

type GetAccountHoldingsParams = {
    db?: DrizzleDatabase
    accountAddress: string
    network: string
}

export function getAccountHoldings({
    db = getDatabase(),
    accountAddress,
    network,
}: GetAccountHoldingsParams): HoldingRow[] {
    return db
        .select({
            assetId: AccountAssetHoldingsSchema.assetId,
            amount: AccountAssetHoldingsSchema.amount,
        })
        .from(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
            ),
        )
        .all()
}

export type AccountBalanceRow = {
    accountAddress: string
    algoBalanceMicro: string
    totalAssetsOptedIn: number
    totalCreatedAssets: number
    totalAppsOptedIn: number
    authAddress: string | null
}

type UpsertAccountBalanceParams = {
    db?: DrizzleDatabase
    accountAddress: string
    network: string
    algoBalanceMicro: string
    totalAssetsOptedIn: number
    totalCreatedAssets: number
    totalAppsOptedIn: number
    authAddress: string | null
}

export function upsertAccountBalance({
    db = getDatabase(),
    accountAddress,
    network,
    algoBalanceMicro,
    totalAssetsOptedIn,
    totalCreatedAssets,
    totalAppsOptedIn,
    authAddress,
}: UpsertAccountBalanceParams): void {
    const now = Date.now()

    db.insert(AccountBalancesSchema)
        .values({
            accountAddress,
            network,
            algoBalanceMicro,
            totalAssetsOptedIn,
            totalCreatedAssets,
            totalAppsOptedIn,
            authAddress,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [
                AccountBalancesSchema.accountAddress,
                AccountBalancesSchema.network,
            ],
            set: {
                algoBalanceMicro,
                totalAssetsOptedIn,
                totalCreatedAssets,
                totalAppsOptedIn,
                authAddress,
                updatedAt: now,
            },
        })
        .run()
}

type GetAccountBalanceParams = {
    db?: DrizzleDatabase
    accountAddress: string
    network: string
}

export function getAccountBalance({
    db = getDatabase(),
    accountAddress,
    network,
}: GetAccountBalanceParams): AccountBalanceRow | undefined {
    const rows = db
        .select({
            accountAddress: AccountBalancesSchema.accountAddress,
            algoBalanceMicro: AccountBalancesSchema.algoBalanceMicro,
            totalAssetsOptedIn: AccountBalancesSchema.totalAssetsOptedIn,
            totalCreatedAssets: AccountBalancesSchema.totalCreatedAssets,
            totalAppsOptedIn: AccountBalancesSchema.totalAppsOptedIn,
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
    db?: DrizzleDatabase
    accountAddresses: string[]
    network: string
}

export function getAllAccountBalances({
    db = getDatabase(),
    accountAddresses,
    network,
}: GetAllAccountBalancesParams): AccountBalanceRow[] {
    if (accountAddresses.length === 0) return []

    return db
        .select({
            accountAddress: AccountBalancesSchema.accountAddress,
            algoBalanceMicro: AccountBalancesSchema.algoBalanceMicro,
            totalAssetsOptedIn: AccountBalancesSchema.totalAssetsOptedIn,
            totalCreatedAssets: AccountBalancesSchema.totalCreatedAssets,
            totalAppsOptedIn: AccountBalancesSchema.totalAppsOptedIn,
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
    db?: DrizzleDatabase
    network: string
}

export function getAllAssetIdsForNetwork({
    db = getDatabase(),
    network,
}: GetAllHoldingsForNetworkParams): string[] {
    const rows = db
        .selectDistinct({
            assetId: AccountAssetHoldingsSchema.assetId,
        })
        .from(AccountAssetHoldingsSchema)
        .where(eq(AccountAssetHoldingsSchema.network, network))
        .all()

    return rows.map(r => r.assetId)
}
