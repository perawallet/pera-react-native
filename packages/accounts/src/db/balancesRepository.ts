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

import { eq, and } from 'drizzle-orm'
import type { Decimal } from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { AccountBalancesSchema } from './schema'

export type AccountBalanceRow = {
    accountAddress: string
    algoBalance: Decimal
    totalAssetsOptedIn: number
    totalCreatedAssets: number
    totalAppsOptedIn: number
    minBalance: Decimal
    status: string
    authAddress: Nullable<string>
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
    authAddress: Nullable<string>
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
}: GetAccountBalanceParams): Promise<Optional<AccountBalanceRow>> {
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

type DeleteAccountBalanceParams = {
    db?: Database
    accountAddress: string
}

/** Deletes every balance row for an account, across all networks. */
export async function deleteAccountBalance({
    db = getDatabase(),
    accountAddress,
}: DeleteAccountBalanceParams): Promise<void> {
    await db
        .delete(AccountBalancesSchema)
        .where(eq(AccountBalancesSchema.accountAddress, accountAddress))
        .run()
}
