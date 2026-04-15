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

import { Decimal } from 'decimal.js'
import {
    accountAssetHoldingsKey,
    accountAssetHoldingsPrefix,
    accountBalancesKey,
    assetsPeraKey,
    getCollections,
    type AccountBalanceCollectionRow,
    type CollectionRegistry,
} from '@perawallet/wallet-core-database'
import { PeraAssetType } from '@perawallet/wallet-core-assets'

type WithRegistry = { registry?: CollectionRegistry }

function resolveRegistry(
    registry: CollectionRegistry | undefined,
): CollectionRegistry {
    return registry ?? getCollections()
}

// ---------------------------------------------------------------------------
// Holdings
// ---------------------------------------------------------------------------

export type HoldingRow = {
    assetId: string
    amount: Decimal
}

type UpsertHoldingInput = {
    assetId: string
    amount: Decimal
}

type UpsertAccountHoldingsParams = WithRegistry & {
    accountAddress: string
    holdings: UpsertHoldingInput[]
    network: string
}

/**
 * Replace every holding for one (network, account) with the supplied set.
 *
 * Wrapped in a single `transact` so subscribers see one atomic update
 * rather than a flicker of "no holdings" followed by each new row. The
 * adapter also gets `deleteMany`/`putMany` batching on commit.
 */
export async function refreshAccountHoldings({
    registry,
    accountAddress,
    holdings,
    network,
}: UpsertAccountHoldingsParams): Promise<void> {
    const { accountAssetHoldings } = resolveRegistry(registry)
    const now = Date.now()

    const prefix = accountAssetHoldingsPrefix({ network, accountAddress })

    accountAssetHoldings.transact(() => {
        const existingKeys: string[] = []
        for (const [key] of accountAssetHoldings.entriesWithPrefix(prefix)) {
            existingKeys.push(key)
        }
        for (const key of existingKeys) {
            accountAssetHoldings.delete(key)
        }

        for (const holding of holdings) {
            accountAssetHoldings.upsert({
                network,
                accountAddress,
                assetId: new Decimal(holding.assetId),
                amount: holding.amount,
                updatedAt: now,
            })
        }
    })
}

type InsertAssetHoldingParams = WithRegistry & {
    accountAddress: string
    assetId: string
    network: string
    amount?: string
}

export async function insertAssetHolding({
    registry,
    accountAddress,
    assetId,
    network,
    amount,
}: InsertAssetHoldingParams): Promise<void> {
    const { accountAssetHoldings } = resolveRegistry(registry)
    const key = accountAssetHoldingsKey({ network, accountAddress, assetId })

    // Mirror the old `.onConflictDoNothing()` semantics: if a row already
    // exists for this (network, account, assetId), leave it alone.
    if (accountAssetHoldings.has(key)) return

    accountAssetHoldings.upsert({
        network,
        accountAddress,
        assetId: new Decimal(assetId),
        amount: new Decimal(amount ?? '0'),
        updatedAt: Date.now(),
    })
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

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

type GetAccountHoldingsParams = WithRegistry & {
    accountAddress: string
    network: string
} & AccountHoldingsFilters

/**
 * Return every holding for one (network, account), optionally filtered
 * by zero balance or asset type.
 *
 * The old SQL version LEFT JOINed `account_asset_holdings` against
 * `assets_pera` to look up `asset_type` for the NFT filter. Here we
 * scan the holdings collection by prefix and sync-lookup each asset's
 * pera metadata in the `assets_pera` collection via `.get()` — that's
 * one `Map.get` per holding, which is faster than a SQL join for the
 * sizes we deal with (10s to 100s of holdings per account).
 */
export async function getAccountHoldings({
    registry,
    accountAddress,
    network,
    hideZeroBalance,
    hideNfts,
    hideOptedInNfts,
    excludeAssetTypes,
}: GetAccountHoldingsParams): Promise<HoldingRow[]> {
    const { accountAssetHoldings, assetsPera } = resolveRegistry(registry)
    const prefix = accountAssetHoldingsPrefix({ network, accountAddress })

    const needsAssetLookup =
        hideNfts === true ||
        hideOptedInNfts === true ||
        !!excludeAssetTypes?.length

    const excludeSet = new Set(excludeAssetTypes ?? [])
    const results: HoldingRow[] = []

    for (const [, holding] of accountAssetHoldings.entriesWithPrefix(prefix)) {
        const isZero = holding.amount.isZero()
        if (hideZeroBalance && isZero) continue

        let assetType: string | null = null
        if (needsAssetLookup) {
            const peraRow = assetsPera.get(
                assetsPeraKey({ network, assetId: holding.assetId }),
            )
            assetType = peraRow?.assetType ?? null
        }

        if (hideNfts && assetType === PeraAssetType.collectible) continue

        if (
            hideOptedInNfts &&
            !hideNfts &&
            assetType === PeraAssetType.collectible &&
            isZero
        ) {
            continue
        }

        if (assetType !== null && excludeSet.has(assetType)) continue

        results.push({
            assetId: holding.assetId.toString(),
            amount: holding.amount,
        })
    }

    return results
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

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

type UpsertAccountBalanceParams = WithRegistry & {
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
    registry,
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
    const { accountBalances } = resolveRegistry(registry)

    accountBalances.upsert({
        network,
        accountAddress,
        algoBalance,
        totalAssetsOptedIn,
        totalCreatedAssets,
        totalAppsOptedIn,
        minBalance,
        status,
        authAddress,
        updatedAt: Date.now(),
    })
}

type GetAccountBalanceParams = WithRegistry & {
    accountAddress: string
    network: string
}

function rowToBalance(row: AccountBalanceCollectionRow): AccountBalanceRow {
    return {
        accountAddress: row.accountAddress,
        algoBalance: row.algoBalance,
        totalAssetsOptedIn: row.totalAssetsOptedIn,
        totalCreatedAssets: row.totalCreatedAssets,
        totalAppsOptedIn: row.totalAppsOptedIn,
        minBalance: row.minBalance,
        status: row.status,
        authAddress: row.authAddress,
    }
}

export async function getAccountBalance({
    registry,
    accountAddress,
    network,
}: GetAccountBalanceParams): Promise<AccountBalanceRow | undefined> {
    const { accountBalances } = resolveRegistry(registry)
    const row = accountBalances.get(
        accountBalancesKey({ network, accountAddress }),
    )
    return row ? rowToBalance(row) : undefined
}

type GetAllAccountBalancesParams = WithRegistry & {
    accountAddresses: string[]
    network: string
}

export async function getAllAccountBalances({
    registry,
    accountAddresses,
    network,
}: GetAllAccountBalancesParams): Promise<AccountBalanceRow[]> {
    if (accountAddresses.length === 0) return []

    const { accountBalances } = resolveRegistry(registry)
    const results: AccountBalanceRow[] = []
    for (const accountAddress of accountAddresses) {
        const row = accountBalances.get(
            accountBalancesKey({ network, accountAddress }),
        )
        if (row !== undefined) results.push(rowToBalance(row))
    }
    return results
}

type DeleteAssetHoldingsParams = WithRegistry & {
    accountAddress: string
    assetIds: string[]
    network: string
}

export async function deleteAssetHoldings({
    registry,
    accountAddress,
    assetIds,
    network,
}: DeleteAssetHoldingsParams): Promise<void> {
    if (assetIds.length === 0) return

    const { accountAssetHoldings } = resolveRegistry(registry)

    accountAssetHoldings.transact(() => {
        for (const assetId of assetIds) {
            accountAssetHoldings.delete(
                accountAssetHoldingsKey({ network, accountAddress, assetId }),
            )
        }
    })
}

type GetAllAssetIdsForNetworkParams = WithRegistry & {
    network: string
}

/**
 * Return every distinct asset id that appears in any holding for the
 * given network. Used by SyncService to know which asset metadata rows
 * to refresh. Infrequent (once per sync tick), so the O(holdings)
 * scan is fine.
 */
export async function getAllAssetIdsForNetwork({
    registry,
    network,
}: GetAllAssetIdsForNetworkParams): Promise<string[]> {
    const { accountAssetHoldings } = resolveRegistry(registry)
    const prefix = `${network}:`
    const seen = new Set<string>()
    for (const [, holding] of accountAssetHoldings.entriesWithPrefix(prefix)) {
        seen.add(holding.assetId.toString())
    }
    return [...seen]
}
