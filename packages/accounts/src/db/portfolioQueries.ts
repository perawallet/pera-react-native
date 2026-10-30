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

import { eq, and, like, sql } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import {
    toScopeKey,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import {
    AssetsNodeSchema,
    AssetPricesSchema,
    nativeAssetFor,
} from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { AccountAssetHoldingsSchema } from './schema'
import { holdingJoin } from './holdingJoin'

export type AccountPortfolioTotals = {
    /**
     * Display units, price-independent — separate from the USD aggregate so the
     * header can render before the native asset's price syncs.
     */
    nativeAmount: Decimal
    /** USD per whole unit of the native asset; null until its price syncs. */
    nativeUsdPrice: Nullable<Decimal>
    /** USD value of all non-native holdings; rows without a price contribute 0. */
    nonNativeUsdValue: Decimal
    /** Number of holdings rows (includes the native holding). */
    holdingsCount: number
    /** While > 0 the enrichment pass is in flight and the total is settling. */
    missingMetadataCount: number
}

/**
 * Splits the native amount and price from the non-native USD value so the
 * header can reflect the native balance before prices sync.
 *
 * The native amount and price are read as TEXT and scaled in JS, so a chain
 * with 18 decimals loses nothing to REAL. Non-native values scale by
 * `CAST('1e' || decimals AS REAL)` rather than `pow`, which SQLite doesn't
 * always ship; that sum is REAL — ample for a displayed total — and wrapped
 * back into Decimal for the app's money convention.
 */
export async function getAccountPortfolioTotals({
    db = getDatabase(),
    accountAddress,
    scope,
}: {
    db?: Database
    accountAddress: string
    scope: ChainScope
}): Promise<AccountPortfolioTotals> {
    const scopeKey = toScopeKey(scope)
    const native = nativeAssetFor(scope.chainId)
    const rows = await db
        .select({
            // The primary key leaves at most one native row, so MAX picks it.
            nativeAmount: sql<Nullable<string>>`MAX(
                CASE WHEN ${AccountAssetHoldingsSchema.assetId} = ${native.assetId}
                    THEN ${AccountAssetHoldingsSchema.amount} END
            )`,
            nativeUsdPrice: sql<Nullable<string>>`MAX(
                CASE WHEN ${AccountAssetHoldingsSchema.assetId} = ${native.assetId}
                    THEN ${AssetPricesSchema.usdPrice} END
            )`,
            nonNativeUsd: sql<Nullable<number>>`COALESCE(SUM(
                CASE WHEN ${AccountAssetHoldingsSchema.assetId} <> ${native.assetId}
                    AND ${AssetsNodeSchema.decimals} IS NOT NULL
                    THEN CAST(${AccountAssetHoldingsSchema.amount} AS REAL)
                        / CAST('1e' || ${AssetsNodeSchema.decimals} AS REAL)
                        * CAST(${AssetPricesSchema.usdPrice} AS REAL)
                    ELSE 0 END
            ), 0)`,
            count: sql<number>`COUNT(*)`,
            missingMetadata: sql<number>`COALESCE(SUM(
                CASE WHEN ${AccountAssetHoldingsSchema.assetId} <> ${native.assetId}
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
                eq(AccountAssetHoldingsSchema.scope, scopeKey),
            ),
        )
        .all()

    const row = rows[0]
    return {
        nativeAmount: baseUnitsToDisplayUnits(
            row?.nativeAmount ?? 0,
            native.decimals,
        ),
        nativeUsdPrice:
            row?.nativeUsdPrice != null
                ? new Decimal(row.nativeUsdPrice)
                : null,
        nonNativeUsdValue: new Decimal(row?.nonNativeUsd ?? 0),
        holdingsCount: row?.count ?? 0,
        missingMetadataCount: row?.missingMetadata ?? 0,
    }
}

/**
 * Networks of `chainId` on which the account holds a non-zero balance of any
 * asset: a token with no native coin beside it is still lost with the keys.
 *
 * Deliberately unfiltered by network: a warning about losing access to an
 * account must not vanish because the user switched to a network where that
 * account happens to be empty. Only networks a prior sync persisted rows for
 * are visible — one never visited on this install contributes nothing.
 */
export async function getAccountFundedNetworks({
    db = getDatabase(),
    accountAddress,
    chainId,
}: {
    db?: Database
    accountAddress: string
    chainId: ChainId
}): Promise<string[]> {
    const rows = await db
        .selectDistinct({ network: AccountAssetHoldingsSchema.scope })
        .from(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                // EVM chains share one address, so the chain must scope it.
                like(AccountAssetHoldingsSchema.scope, `${chainId}/%`),
                // Amounts are stored as TEXT; compare numerically so '0' and a
                // padded zero both read as unfunded.
                sql`CAST(${AccountAssetHoldingsSchema.amount} AS REAL) > 0`,
            ),
        )
        .all()

    return rows.map(row => row.network)
}
