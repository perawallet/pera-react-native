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
 * Whether reconfiguring the custom slot invalidates its cached data.
 *
 * Keyed on genesis hash, NOT on URL: the same chain reached through a new host
 * (a LAN address change, a container restart on a different port) must keep its
 * cache, while a genuinely different chain must not — otherwise two chains' rows
 * mix under the single `custom` partition.
 *
 * First configuration returns false: there is no prior chain and nothing cached.
 */
export const shouldClearCustomCache = (
    previous: CustomNetworkConfig | undefined,
    next: CustomNetworkConfig,
): boolean =>
    previous !== undefined && previous.genesisHash !== next.genesisHash

// Physical tables partitioned by a `network` column, spread across the four
// domain packages that own them (see each package's src/db/schema.ts):
//   - accounts:      account_asset_holdings, account_balances
//   - assets:        assets_node, assets_pera, asset_prices
//   - transactions:  transactions, account_transactions
//   - nfd:           nfd_cache
// Named directly as literal SQL rather than importing each package's Drizzle
// schema object: accounts/assets/transactions/nfd all depend on `blockchain`,
// so importing them back here would create a dependency cycle.
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
 * The first segment of every query key the same four domains produce (see
 * each package's src/hooks/querykeys.ts MODULE_PREFIX). Duplicated here for
 * the same cross-cycle reason as the table list above — but unlike the table
 * list, a stale entry here fails silently (a missed cache eviction, not a SQL
 * error), so this one is exported specifically so the four domain packages
 * can defend the correspondence themselves: each carries a test (e.g.
 * `packages/accounts/src/hooks/__tests__/querykeys.test.ts`) asserting its
 * own `MODULE_PREFIX` is a member of this set. Those packages already depend
 * on `blockchain`, so importing this back into them is cycle-free — it's
 * only the reverse direction (blockchain importing their `querykeys.ts`
 * modules) that isn't. A rename in any of the four now fails a test in the
 * package doing the renaming, where the person making the change will see it.
 *
 * Not exactly "packages with a DB table": `packages/currencies`'
 * `algoUsdPrice` key deliberately nests itself under `'assets'` (not
 * `'currencies'`) for cache locality
 * (`packages/currencies/src/hooks/querykeys.ts`), so it is coincidentally
 * swept too when scoped to `custom`. That's fine — it's still per-network
 * price data — just noted so the reach isn't assumed to stop at these four
 * packages' own tables.
 */
export const NETWORK_PARTITIONED_QUERY_MODULES: ReadonlySet<string> = new Set([
    'accounts',
    'assets',
    'transactions',
    'nfd',
])

/**
 * True when a query key belongs to one of the four network-partitioned
 * domains AND carries a `network: 'custom'` field in one of its payload
 * objects — mirroring how every one of those domains' key factories embed
 * `{ ..., network, ... }` somewhere in the key (see e.g.
 * `packages/assets/src/hooks/querykeys.ts`).
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
 * Deletes every row and cached query result scoped to the `custom` network
 * slot: the DB rows in each network-partitioned table across the
 * accounts/assets/transactions/nfd packages, plus the matching TanStack query
 * cache entries.
 *
 * Call this whenever {@link shouldClearCustomCache} reports that reconfiguring
 * the custom slot changed its chain identity — never on first configuration,
 * and never for a host/token-only edit of the same chain, or two unrelated
 * chains' data ends up mixed under the single `custom` partition.
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
