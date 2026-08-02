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

import { type QueryClient } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'
import {
    fetchAndPersistAssets,
    fetchAndPersistPrices,
} from '@perawallet/wallet-core-assets'
import {
    upsertAccountBalance,
    refreshAccountHoldings,
    getAccountBalance,
    getAccountHoldings,
} from '../db'
// Imported directly (not via the hooks barrel) to avoid a module cycle:
// hooks/useEnsureAccountEnriched imports from this file.
import { invalidateAccountQueriesForAddresses } from '../hooks/querykeys'
import { useAccountsStore } from '../store'
import {
    ALGO_ASSET_ID,
    logger,
    type Network,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'

// Max holdings per indexer page, used by the large-account fallback path.
export const HOLDINGS_PAGE_LIMIT = 1000

// algod rejects full account reads (exclude=none) with HTTP 400 once the
// account's total resources (asset holdings + created assets + app local
// states + created apps) exceed the node's MaxAPIResourcesPerAccount, which
// defaults to 1000. Below that, one algod call returns balance AND holdings
// from the same round — unlike the indexer, which lags algod by a few seconds
// and can hand back pre-transaction holdings right after a confirmation.
const MAX_INLINE_RESOURCES = 1000

export type AccountSyncResult = {
    /** True if the balance row or holdings changed — drives query invalidation. */
    changed: boolean
    /** True if the holding set/amounts changed — drives asset/price re-sync. */
    holdingsChanged: boolean
    /**
     * Chain round the persisted state is valid for — the minimum round across
     * the sources read (algod info, and indexer holdings pages on the
     * large-account path). The sync service uses this to advance the
     * should-refresh checkpoint only past rounds it has actually observed, so
     * a lagging source can't permanently swallow an update. Null when the
     * node response omits the round.
     */
    observedRound: Nullable<number>
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

/**
 * Targeted first-read sync for an account that was just added to the wallet
 * (imported, created, watched, or discovered).
 *
 * The gated background poll won't pick a new account up on its own: its
 * activity predates the should-refresh checkpoint, so the backend keeps
 * answering "nothing new" and the sync's asset/price pass never runs for its
 * holdings. The read-time self-heal only fetches holdings — without asset
 * metadata the balance reads deliberately render zero amounts (no decimals to
 * scale by), and without prices the account contributes nothing to the
 * portfolio value. So fetch the account AND enrich metadata + prices here,
 * invalidating after each phase so the UI fills in as data lands.
 *
 * Always fetches (no balance-row short-circuit) so a removed-and-re-imported
 * account starts from fresh chain state rather than leftover rows. Failures
 * are logged, never thrown — the read-time self-heal and the account-overview
 * enrichment remain the safety nets.
 */
export async function syncAndEnrichNewAccount(
    address: string,
    network: Network,
    queryClient: QueryClient,
): Promise<void> {
    try {
        await fetchAndPersistAccount(address, network)
        invalidateAccountQueriesForAddresses(queryClient, [address])

        const holdings = await getAccountHoldings({
            accountAddress: address,
            network,
        })
        const assetIds = holdings.map(h => h.assetId)
        if (assetIds.length === 0) return

        // Metadata + prices in parallel; both fetchers skip already-fresh
        // assets, so overlap with the background sync stays cheap.
        await Promise.allSettled([
            fetchAndPersistAssets(assetIds, network),
            fetchAndPersistPrices(assetIds, network),
        ])
        invalidateAccountQueriesForAddresses(queryClient, [address])
    } catch (error) {
        logger.warn('New-account sync failed', {
            address,
            network,
            error:
                error instanceof Error
                    ? { message: error.message, stack: error.stack }
                    : error,
        })
    }
}

const isResourceLimitError = (error: unknown): boolean =>
    error instanceof Error &&
    'status' in error &&
    (error as { status: unknown }).status === 400

const toRound = (round: Optional<bigint>): Nullable<number> =>
    round === undefined ? null : Number(round)

const minRound = (a: Nullable<number>, b: Nullable<number>): Nullable<number> =>
    a === null ? b : b === null ? a : Math.min(a, b)

/**
 * Fetch balance info + ASA holdings for an account, preferring a single algod
 * read so both come from the same (current) round.
 *
 * Falls back to the split read — algod info without assets + paginated indexer
 * holdings — when the account is too large for algod's inline-resource cap:
 * pre-emptively when the last persisted resource counts already exceed it, or
 * reactively when algod rejects the full read with 400.
 */
async function fetchAccountSnapshot(
    algokit: ReturnType<typeof getAlgorandClient>,
    address: string,
    priorResourceCount: number,
) {
    if (priorResourceCount < MAX_INLINE_RESOURCES) {
        try {
            const info = await algokit.client.algod
                .accountInformation(address)
                .do()
            const holdings: HoldingInput[] = (info.assets ?? []).map(asset => ({
                assetId: `${asset.assetId}`,
                amount: new Decimal((asset.amount ?? 0n).toString()),
            }))
            return { info, holdings, observedRound: toRound(info.round) }
        } catch (error) {
            if (!isResourceLimitError(error)) throw error
        }
    }

    const info = await algokit.client.algod
        .accountInformation(address)
        .exclude('all')
        .do()
    const { holdings, currentRound } = await fetchAllHoldings(algokit, address)
    return {
        info,
        holdings,
        observedRound: minRound(toRound(info.round), currentRound),
    }
}

async function fetchAllHoldings(
    algokit: ReturnType<typeof getAlgorandClient>,
    address: string,
): Promise<{ holdings: HoldingInput[]; currentRound: Nullable<number> }> {
    const holdings: HoldingInput[] = []
    let currentRound: Nullable<number> = null
    let next: Optional<string>

    do {
        let request = algokit.client.indexer
            .lookupAccountAssets(address)
            .limit(HOLDINGS_PAGE_LIMIT)
        if (next) request = request.nextToken(next)
        const page = await request.do()
        currentRound = minRound(currentRound, toRound(page.currentRound))
        for (const asset of page.assets ?? []) {
            holdings.push({
                assetId: `${asset.assetId}`,
                amount: new Decimal((asset.amount ?? 0n).toString()),
            })
        }
        next = page.nextToken
    } while (next)

    return { holdings, currentRound }
}

async function doFetchAndPersistAccount(
    address: string,
    network: Network,
): Promise<AccountSyncResult> {
    const algokit = getAlgorandClient(network)

    // The prior balance row both gates the inline-holdings read (its resource
    // counts say whether the account fits algod's cap) and feeds the
    // changed-account diff below.
    const prior = await getAccountBalance({ accountAddress: address, network })
    const priorResourceCount = prior
        ? prior.totalAssetsOptedIn +
          prior.totalCreatedAssets +
          prior.totalAppsOptedIn
        : 0

    const { info, holdings, observedRound } = await fetchAccountSnapshot(
        algokit,
        address,
        priorResourceCount,
    )

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

    useAccountsStore
        .getState()
        .updateAccountRekeyAddress(address, authAddress, network)

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

    return {
        changed: balanceChanged || holdingsChanged,
        holdingsChanged,
        observedRound,
    }
}
