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

import { sql } from 'drizzle-orm'
import { type QueryClient, type QueryKey } from '@tanstack/react-query'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import { Networks } from '@perawallet/wallet-core-config'
import { type CustomNetworkConfig } from '../store'

/**
 * Keyed on genesis hash, NOT URL: the same chain behind a new host (LAN address
 * change, container restart) keeps its cache, while a different chain must not —
 * otherwise two chains' rows mix under the single `custom` partition. First
 * configuration returns false; there's nothing cached yet.
 */
export const shouldClearCustomCache = (
    previous: CustomNetworkConfig | undefined,
    next: CustomNetworkConfig,
): boolean =>
    previous !== undefined && previous.genesisHash !== next.genesisHash

// Every table partitioned by a `network` column, across the four domain packages
// that own them. Named as literal SQL rather than imported Drizzle schemas:
// those packages all depend on `blockchain`, so importing back would cycle.
const CUSTOM_NETWORK_PARTITIONED_TABLES = [
    'account_asset_holdings',
    'account_balances',
    'assets_node',
    'assets_pera',
    'asset_prices',
    'transactions',
    'account_transactions',
    'nfd_cache',
] as const

/**
 * Each domain's `MODULE_PREFIX`, duplicated here for the same cycle reason as the
 * table list. Unlike that list, a stale entry fails SILENTLY — a missed eviction,
 * not a SQL error — so this is exported and each domain package carries a test
 * asserting its own prefix is a member. A rename then fails a test in the package
 * doing the renaming.
 *
 * Reach isn't exactly "packages with a DB table": `currencies`' `algoUsdPrice`
 * nests under `'assets'` for cache locality, so it's swept too. Fine — it's still
 * per-network price data.
 */
export const NETWORK_PARTITIONED_QUERY_MODULES: ReadonlySet<string> = new Set([
    'accounts',
    'assets',
    'transactions',
    'nfd',
])

/**
 * Mirrors how those domains' key factories all embed `{ ..., network, ... }`
 * somewhere in the key.
 */
const queryKeyTargetsCustomNetwork = (queryKey: QueryKey): boolean => {
    const [modulePrefix] = queryKey
    if (
        typeof modulePrefix !== 'string' ||
        !NETWORK_PARTITIONED_QUERY_MODULES.has(modulePrefix)
    ) {
        return false
    }

    return queryKey.some(part => {
        if (typeof part !== 'object' || part === null) return false
        return (part as Record<string, unknown>).network === Networks.custom
    })
}

/**
 * Deletes every DB row and query-cache entry scoped to the `custom` slot.
 *
 * Call only when {@link shouldClearCustomCache} says the chain identity changed
 * — never on first configuration, never for a host-only edit of the same chain.
 */
export const clearCustomNetworkCache = async (
    queryClient: QueryClient,
    db: Database = getDatabase(),
): Promise<void> => {
    for (const table of CUSTOM_NETWORK_PARTITIONED_TABLES) {
        await db.run(
            sql`DELETE FROM ${sql.raw(table)} WHERE network = ${Networks.custom}`,
        )
    }

    queryClient.removeQueries({
        predicate: query => queryKeyTargetsCustomNetwork(query.queryKey),
    })
}
