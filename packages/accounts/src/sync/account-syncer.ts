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

// algod rejects a full account read with HTTP 400 once total resources exceed
// MaxAPIResourcesPerAccount (default 1000). Below that, one call returns balance
// AND holdings from the same round — unlike the indexer, which lags by seconds
// and can hand back pre-transaction holdings right after a confirmation.
const MAX_INLINE_RESOURCES = 1000

export type AccountSyncResult = {
    /** True if the balance row or holdings changed — drives query invalidation. */
    changed: boolean
    /** True if the holding set/amounts changed — drives asset/price re-sync. */
    holdingsChanged: boolean
    /**
     * The MINIMUM round across every source read, so the sync service advances
     * its checkpoint only past rounds it actually observed and a lagging source
     * can't permanently swallow an update. Null when the node omits it.
     */
    observedRound: Nullable<number>
}

type HoldingInput = { assetId: string; amount: Decimal }

// On a fresh import the background sync and every balance/summary query call
// this with no balance row yet, firing N parallel account and holdings fetches
// that all contend on the single SQLite connection. One shared in-flight promise
// collapses them to a single pass.
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
 * The home-screen reads rely on the background sync, but a freshly imported
 * account may not be picked up by the next gated tick — so fetch once when there
 * is no balance row yet. Deduped via `fetchAndPersistAccount`'s in-flight map,
 * so the summary and first holdings page collapse to one fetch.
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
 * First-read sync for a newly added account. The gated poll won't pick one up on
 * its own — its activity predates the should-refresh checkpoint, so the backend
 * keeps answering "nothing new" — and the read-time self-heal only fetches
 * holdings, which without metadata render as zero amounts and without prices
 * contribute nothing to the portfolio. So enrich metadata and prices here too,
 * invalidating after each phase so the UI fills in as data lands.
 *
 * Always fetches, with no balance-row short-circuit, so a re-imported account
 * starts from fresh chain state. Failures are logged, never thrown.
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

const minRound = (
    a: Nullable<number>,
    b: Nullable<number>,
): Nullable<number> => (a === null ? b : b === null ? a : Math.min(a, b))

/**
 * Prefers a single algod read so balance and holdings come from the same round.
 * Falls back to the split read (algod info plus paginated indexer holdings) when
 * the account exceeds algod's inline-resource cap — pre-emptively from the last
 * persisted counts, or reactively on a 400.
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

    // ALGO is persisted as a regular holding in base units, so the home-screen
    // reads sort, filter and paginate it uniformly alongside ASAs with no
    // synthetic-row union in the hot path. Its metadata is seeded at startup and
    // its price syncs under id '0', so the join resolves it like any asset.
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
