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

import { getDatabase, type Database } from '@perawallet/wallet-core-database'

export type HoldingRow = {
    assetId: string
    amount: string
}

type UpsertAccountHoldingsParams = {
    db?: Database
    accountAddress: string
    holdings: HoldingRow[]
    network: string
}

export async function upsertAccountHoldings({
    db = getDatabase(),
    accountAddress,
    holdings,
    network,
}: UpsertAccountHoldingsParams): Promise<void> {
    const now = Date.now()

    await db.withTransactionAsync(async () => {
        await db.runAsync(
            `DELETE FROM account_asset_holdings WHERE account_address = ? AND network = ?`,
            [accountAddress, network],
        )

        if (holdings.length === 0) return

        const placeholders = holdings.map(() => '(?, ?, ?, ?, ?)').join(', ')
        const values = holdings.flatMap(h => [
            accountAddress,
            h.assetId,
            network,
            h.amount,
            now,
        ])

        await db.runAsync(
            `INSERT INTO account_asset_holdings (account_address, asset_id, network, amount, updated_at) VALUES ${placeholders}`,
            values,
        )
    })
}

type GetAccountHoldingsParams = {
    db?: Database
    accountAddress: string
    network: string
}

export async function getAccountHoldings({
    db = getDatabase(),
    accountAddress,
    network,
}: GetAccountHoldingsParams): Promise<HoldingRow[]> {
    const rows = await db.getAllAsync<{
        asset_id: string
        amount: string
    }>(
        `SELECT asset_id, amount FROM account_asset_holdings WHERE account_address = ? AND network = ?`,
        [accountAddress, network],
    )

    return rows.map(r => ({ assetId: r.asset_id, amount: r.amount }))
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
    db?: Database
    accountAddress: string
    network: string
    algoBalanceMicro: string
    totalAssetsOptedIn: number
    totalCreatedAssets: number
    totalAppsOptedIn: number
    authAddress: string | null
}

export async function upsertAccountBalance({
    db = getDatabase(),
    accountAddress,
    network,
    algoBalanceMicro,
    totalAssetsOptedIn,
    totalCreatedAssets,
    totalAppsOptedIn,
    authAddress,
}: UpsertAccountBalanceParams): Promise<void> {
    const now = Date.now()

    await db.runAsync(
        `INSERT INTO account_balances (account_address, network, algo_balance_micro, total_assets_opted_in, total_created_assets, total_apps_opted_in, auth_address, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (account_address, network) DO UPDATE SET
            algo_balance_micro = excluded.algo_balance_micro,
            total_assets_opted_in = excluded.total_assets_opted_in,
            total_created_assets = excluded.total_created_assets,
            total_apps_opted_in = excluded.total_apps_opted_in,
            auth_address = excluded.auth_address,
            updated_at = excluded.updated_at`,
        [
            accountAddress,
            network,
            algoBalanceMicro,
            totalAssetsOptedIn,
            totalCreatedAssets,
            totalAppsOptedIn,
            authAddress,
            now,
        ],
    )
}

type RawAccountBalanceRow = {
    account_address: string
    algo_balance_micro: string
    total_assets_opted_in: number
    total_created_assets: number
    total_apps_opted_in: number
    auth_address: string | null
}

function mapAccountBalanceRow(row: RawAccountBalanceRow): AccountBalanceRow {
    return {
        accountAddress: row.account_address,
        algoBalanceMicro: row.algo_balance_micro,
        totalAssetsOptedIn: row.total_assets_opted_in,
        totalCreatedAssets: row.total_created_assets,
        totalAppsOptedIn: row.total_apps_opted_in,
        authAddress: row.auth_address,
    }
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
    const row = await db.getFirstAsync<RawAccountBalanceRow>(
        `SELECT account_address, algo_balance_micro, total_assets_opted_in, total_created_assets, total_apps_opted_in, auth_address
         FROM account_balances
         WHERE account_address = ? AND network = ?`,
        [accountAddress, network],
    )

    return row ? mapAccountBalanceRow(row) : undefined
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

    const placeholders = accountAddresses.map(() => '?').join(', ')

    const rows = await db.getAllAsync<RawAccountBalanceRow>(
        `SELECT account_address, algo_balance_micro, total_assets_opted_in, total_created_assets, total_apps_opted_in, auth_address
         FROM account_balances
         WHERE account_address IN (${placeholders}) AND network = ?`,
        [...accountAddresses, network],
    )

    return rows.map(mapAccountBalanceRow)
}

type GetAllHoldingsForNetworkParams = {
    db?: Database
    network: string
}

export async function getAllAssetIdsForNetwork({
    db = getDatabase(),
    network,
}: GetAllHoldingsForNetworkParams): Promise<string[]> {
    const rows = await db.getAllAsync<{ asset_id: string }>(
        `SELECT DISTINCT asset_id FROM account_asset_holdings WHERE network = ?`,
        [network],
    )

    return rows.map(r => r.asset_id)
}
