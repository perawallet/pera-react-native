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
import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import {
    upsertAccountBalance,
    refreshAccountHoldings,
    getAccountBalance,
} from '../db'
import { useAccountsStore } from '../store'
import {
    logger,
    type Network,
    type Optional,
} from '@perawallet/wallet-core-shared'

// Max holdings per indexer page. The indexer caps results and returns a
// nextToken for the rest, so we page through rather than pulling the entire
// (potentially many-thousand-asset) holding set inline via algod — which for a
// large account is a multi-megabyte response parsed on the JS thread.
const HOLDINGS_PAGE_LIMIT = 1000

export type AccountSyncResult = {
    /** True if the balance row or holdings changed — drives query invalidation. */
    changed: boolean
    /** True if the holding set/amounts changed — drives asset/price re-sync. */
    holdingsChanged: boolean
}

type HoldingInput = { assetId: string; amount: Decimal }

// Coalesce concurrent fetches for the same account into one. On a fresh import
// the background sync and every distinct balance/summary query call this with
// no balance row yet, which would otherwise fire N parallel account fetches + N
// parallel paginated holdings fetches, all contending on the single SQLite
// connection. Sharing one in-flight promise collapses that to a single pass.
const inFlight = new Map<string, Promise<AccountSyncResult>>()

export function fetchAndPersistAccount(
    address: string,
    network: Network,
): Promise<AccountSyncResult> {
    const key = `${network}:${address}`
    const existing = inFlight.get(key)
    if (existing) return existing

    const promise = doFetchAndPersistAccount(address, network).finally(() => {
        inFlight.delete(key)
    })
    inFlight.set(key, promise)
    return promise
}

/**
 * Ensure an account has been fetched into the DB at least once before a read.
 *
 * The home-screen reads (summary, holdings page) rely on the background sync to
 * populate holdings, but a freshly imported/selected account may not be picked
 * up by the next gated poll tick (the sync is already running, and
 * `checkShouldRefresh` can skip it). So trigger a one-off fetch when there's no
 * balance row yet — restoring the self-heal the old balances query did on read.
 * Deduped via `fetchAndPersistAccount`'s in-flight map, so the summary and the
 * first holdings page collapse to a single fetch.
 */
export async function ensureAccountFetched(
    address: string,
    network: Network,
): Promise<void> {
    const balance = await getAccountBalance({
        accountAddress: address,
        network,
    })
    if (balance) return
    try {
        await fetchAndPersistAccount(address, network)
    } catch (error) {
        logger.warn('On-demand account fetch failed', {
            address,
            network,
            error:
                error instanceof Error
                    ? { message: error.message, stack: error.stack }
                    : error,
        })
    }
}

async function fetchAllHoldings(
    algokit: ReturnType<typeof getAlgorandClient>,
    address: string,
): Promise<HoldingInput[]> {
    const holdings: HoldingInput[] = []
    let next: Optional<string>

    do {
        const page = await algokit.client.indexer.lookupAccountAssets(address, {
            limit: HOLDINGS_PAGE_LIMIT,
            next,
        })
        for (const asset of page.assets ?? []) {
            holdings.push({
                assetId: `${asset.assetId}`,
                amount: new Decimal((asset.amount ?? 0n).toString()),
            })
        }
        next = page.nextToken
    } while (next)

    return holdings
}

async function doFetchAndPersistAccount(
    address: string,
    network: Network,
): Promise<AccountSyncResult> {
    const algokit = getAlgorandClient(network)

    // Account info WITHOUT the asset list (`exclude: 'all'`) — a small, fast
    // payload (balance, opt-in counts, min-balance, status, rekey). Holdings
    // come separately via the paginated indexer below, so a large account no
    // longer pulls thousands of assets inline here.
    const info = await algokit.client.algod.accountInformation(address, {
        exclude: 'all',
    })

    const authAddress = info.authAddr?.toString() ?? null
    const algoBalance = new Decimal(info.amount.toString()).div(1_000_000)
    const totalAssetsOptedIn = info.totalAssetsOptedIn ?? 0
    const totalCreatedAssets = info.totalCreatedAssets ?? 0
    const totalAppsOptedIn = info.totalAppsOptedIn ?? 0
    const minBalance = new Decimal(info.minBalance.toString()).div(1_000_000)
    const status = info.status ?? 'Offline'

    // Diff against the persisted balance row so the sync service can tell
    // whether the account changed at all this tick. ASA amount changes are
    // caught by refreshAccountHoldings below; this covers algo balance /
    // opt-in counts / status / rekey.
    const prior = await getAccountBalance({ accountAddress: address, network })
    const balanceChanged =
        !prior ||
        prior.algoBalance.toString() !== algoBalance.toString() ||
        prior.totalAssetsOptedIn !== totalAssetsOptedIn ||
        prior.totalCreatedAssets !== totalCreatedAssets ||
        prior.totalAppsOptedIn !== totalAppsOptedIn ||
        prior.minBalance.toString() !== minBalance.toString() ||
        prior.status !== status ||
        (prior.authAddress ?? null) !== authAddress

    await upsertAccountBalance({
        accountAddress: address,
        network,
        algoBalance,
        totalAssetsOptedIn,
        totalCreatedAssets,
        totalAppsOptedIn,
        minBalance,
        status,
        authAddress,
    })

    useAccountsStore.getState().updateAccountRekeyAddress(address, authAddress)

    const holdings = await fetchAllHoldings(algokit, address)

    // Persist ALGO as a regular holding (in base units / microalgos, matching
    // ASA amounts and ALGO's 6 decimals) so the home-screen reads can sort,
    // filter and paginate it uniformly alongside ASAs — no synthetic-row union
    // or per-row special-casing in the hot read path. ALGO metadata is seeded
    // into assets_node/assets_pera at startup and its price syncs under id '0',
    // so the holdings-page join resolves it like any asset. The display-unit
    // algo balance also lives on the account_balances row for non-list callers.
    holdings.unshift({
        assetId: ALGO_ASSET_ID,
        amount: new Decimal(info.amount.toString()),
    })

    const holdingsChanged = await refreshAccountHoldings({
        accountAddress: address,
        holdings,
        network,
    })

    return { changed: balanceChanged || holdingsChanged, holdingsChanged }
}
