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

import type { Decimal } from 'decimal.js'

/**
 * Collection definitions for the two account-level tables.
 *
 *   - `account_balances`         — one row per (network, account) with
 *                                   ALGO balance, opted-in counts, auth addr.
 *   - `account_asset_holdings`   — one row per (network, account, asset)
 *                                   with the holding amount.
 *
 * Keys are network-prefixed so a prefix scan yields every row for one
 * network; accounts are next so a prefix scan yields every holding for
 * one account on one network (used by `refreshAccountHoldings`).
 */

// --- account_balances -------------------------------------------------------

export type AccountBalanceRow = {
    network: string
    accountAddress: string
    /** ALGO balance in display units (ALGOs, not microAlgos). */
    algoBalance: Decimal
    totalAssetsOptedIn: number
    totalCreatedAssets: number
    totalAppsOptedIn: number
    /** Minimum balance in display units (ALGOs, not microAlgos). */
    minBalance: Decimal
    status: string
    authAddress: string | null
    updatedAt: number
}

export const ACCOUNT_BALANCES_COLLECTION_NAME = 'account_balances'
export const ACCOUNT_BALANCES_SCHEMA_VERSION = 1

export function accountBalancesKey(row: {
    network: string
    accountAddress: string
}): string {
    return `${row.network}:${row.accountAddress}`
}

// --- account_asset_holdings -------------------------------------------------

export type AccountAssetHoldingRow = {
    network: string
    accountAddress: string
    assetId: Decimal
    /** Amount in base units (smallest indivisible unit of the asset). */
    amount: Decimal
    updatedAt: number
}

export const ACCOUNT_ASSET_HOLDINGS_COLLECTION_NAME = 'account_asset_holdings'
export const ACCOUNT_ASSET_HOLDINGS_SCHEMA_VERSION = 1

export function accountAssetHoldingsKey(row: {
    network: string
    accountAddress: string
    assetId: Decimal | string
}): string {
    return `${row.network}:${row.accountAddress}:${row.assetId.toString()}`
}

/**
 * Prefix used to scan every holding for one (network, account) pair.
 * Matches the composite-key SQL pattern `WHERE network = ? AND account = ?`
 * that the old Drizzle implementation used.
 */
export function accountAssetHoldingsPrefix(params: {
    network: string
    accountAddress: string
}): string {
    return `${params.network}:${params.accountAddress}:`
}
