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

import { eq, and, sql } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import {
    AssetsNodeSchema,
    AssetPricesSchema,
} from '@perawallet/wallet-core-assets'
import { ALGO_ASSET_ID, type Nullable } from '@perawallet/wallet-core-shared'
import { AccountAssetHoldingsSchema } from './schema'
import { holdingJoin } from './holdingJoin'

export type AccountPortfolioTotals = {
    /**
     * Display units, price-independent — separate from the USD aggregate so the
     * header can render before the ALGO price syncs.
     */
    algoAmount: Decimal
    /** USD value of all non-ALGO holdings; rows without a price contribute 0. */
    nonAlgoUsdValue: Decimal
    /** Number of holdings rows (includes the ALGO holding). */
    holdingsCount: number
    /** While > 0 the enrichment pass is in flight and the total is settling. */
    missingMetadataCount: number
}

/**
 * Splits the raw ALGO amount from the non-ALGO USD value so the header can
 * reflect the native balance before prices sync.
 *
 * Scales by `CAST('1e' || decimals AS REAL)` rather than `pow`, which SQLite
 * doesn't always ship. Sums are REAL — ample for a displayed total — and
 * wrapped back into Decimal for the app's money convention.
 */
export async function getAccountPortfolioTotals({
    db = getDatabase(),
    accountAddress,
    network,
}: {
    db?: Database
    accountAddress: string
    network: string
}): Promise<AccountPortfolioTotals> {
    const rows = await db
        .select({
            algoAmount: sql<Nullable<number>>`COALESCE(SUM(
                CASE WHEN ${AccountAssetHoldingsSchema.assetId} = '0'
                    THEN CAST(${AccountAssetHoldingsSchema.amount} AS REAL) / 1000000.0
                    ELSE 0 END
            ), 0)`,
            nonAlgoUsd: sql<Nullable<number>>`COALESCE(SUM(
                CASE WHEN ${AccountAssetHoldingsSchema.assetId} <> '0'
                    AND ${AssetsNodeSchema.decimals} IS NOT NULL
                    THEN CAST(${AccountAssetHoldingsSchema.amount} AS REAL)
                        / CAST('1e' || ${AssetsNodeSchema.decimals} AS REAL)
                        * CAST(${AssetPricesSchema.usdPrice} AS REAL)
                    ELSE 0 END
            ), 0)`,
            count: sql<number>`COUNT(*)`,
            missingMetadata: sql<number>`COALESCE(SUM(
                CASE WHEN ${AccountAssetHoldingsSchema.assetId} <> '0'
                    AND ${AssetsNodeSchema.decimals} IS NULL
                    THEN 1 ELSE 0 END
            ), 0)`,
        })
        .from(AccountAssetHoldingsSchema)
        .leftJoin(AssetsNodeSchema, holdingJoin(AssetsNodeSchema))
        .leftJoin(AssetPricesSchema, holdingJoin(AssetPricesSchema))
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
            ),
        )
        .all()

    const row = rows[0]
    return {
        algoAmount: new Decimal(row?.algoAmount ?? 0),
        nonAlgoUsdValue: new Decimal(row?.nonAlgoUsd ?? 0),
        holdingsCount: row?.count ?? 0,
        missingMetadataCount: row?.missingMetadata ?? 0,
    }
}

/**
 * Networks on which the account holds a non-zero ALGO balance.
 *
 * Deliberately unfiltered by network: a warning about losing access to an
 * account must not vanish because the user switched to a network where that
 * account happens to be empty. Only networks a prior sync persisted rows for
 * are visible — one never visited on this install contributes nothing.
 */
export async function getAccountFundedNetworks({
    db = getDatabase(),
    accountAddress,
}: {
    db?: Database
    accountAddress: string
}): Promise<string[]> {
    const rows = await db
        .select({ network: AccountAssetHoldingsSchema.network })
        .from(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(
                    AccountAssetHoldingsSchema.assetId,
                    new Decimal(ALGO_ASSET_ID),
                ),
                // Amounts are stored as TEXT; compare numerically so '0' and a
                // padded zero both read as unfunded.
                sql`CAST(${AccountAssetHoldingsSchema.amount} AS REAL) > 0`,
            ),
        )
        .all()

    return rows.map(row => row.network)
}
