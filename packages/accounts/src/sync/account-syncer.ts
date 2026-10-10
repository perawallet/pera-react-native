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

import type { QueryClient } from '@tanstack/react-query'
import {
    fetchAndPersistAssets,
    fetchAndPersistPrices,
} from '@perawallet/wallet-core-assets'
import {
    toScopeKey,
    legacyNetworkOf,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import {
    upsertAccountBalance,
    upsertAccountChainState,
    refreshAccountHoldings,
    getAccountBalance,
    getAccountHoldings,
} from '../db'
// Imported directly (not via the hooks barrel) to avoid a module cycle:
// hooks/useEnsureAccountEnriched imports from this file.
import { invalidateAccountQueriesForAddresses } from '../hooks/querykeys'
import { accountsChainAdapters } from '../chain-adapter'
import { useAccountChainStateStore } from '../store/accountChainState'

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

// On a fresh import the background sync and every balance/summary query call
// this with no balance row yet, firing N parallel account and holdings fetches
// that all contend on the single SQLite connection. One shared in-flight promise
// collapses them to a single pass.
const inFlight = new Map<string, Promise<AccountSyncResult>>()

export function fetchAndPersistAccount(
    address: string,
    scope: ChainScope,
): Promise<AccountSyncResult> {
    const key = `${toScopeKey(scope)}:${address}`
    const existing = inFlight.get(key)
    if (existing) return existing

    const promise = doFetchAndPersistAccount(address, scope).finally(() => {
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
    scope: ChainScope,
): Promise<void> {
    const balance = await getAccountBalance({
        accountAddress: address,
        scope,
    })
    if (balance) return
    try {
        await fetchAndPersistAccount(address, scope)
    } catch (error) {
        logger.warn('On-demand account fetch failed', {
            address,
            scope,
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
    scope: ChainScope,
    queryClient: QueryClient,
): Promise<void> {
    try {
        await fetchAndPersistAccount(address, scope)
        invalidateAccountQueriesForAddresses(queryClient, [address])

        const holdings = await getAccountHoldings({
            accountAddress: address,
            scope,
        })
        const assetIds = holdings.map(h => h.assetId)
        if (assetIds.length === 0) return

        // Metadata + prices in parallel; both fetchers skip already-fresh
        // assets, so overlap with the background sync stays cheap.
        await Promise.allSettled([
            fetchAndPersistAssets(assetIds, scope),
            fetchAndPersistPrices(assetIds, legacyNetworkOf(scope)),
        ])
        invalidateAccountQueriesForAddresses(queryClient, [address])
    } catch (error) {
        logger.warn('New-account sync failed', {
            address,
            scope,
            error:
                error instanceof Error
                    ? { message: error.message, stack: error.stack }
                    : error,
        })
    }
}

async function doFetchAndPersistAccount(
    address: string,
    scope: ChainScope,
): Promise<AccountSyncResult> {
    // The prior balance row both tells the chain how large the account was at
    // its last sync (which can decide its read strategy) and feeds the
    // changed-account diff below.
    const adapter = accountsChainAdapters.get(scope.chainId)
    const prior = await getAccountBalance({ accountAddress: address, scope })
    const priorResourceCount = prior
        ? prior.totalAssetsOptedIn +
          prior.totalCreatedAssets +
          prior.totalAppsOptedIn
        : 0

    // The Algorand-only fields fall back to the balance row's column defaults.
    const {
        nativeBalance: algoBalance,
        minBalance,
        totalAssetsOptedIn = 0,
        totalCreatedAssets = 0,
        totalAppsOptedIn = 0,
        status = 'Offline',
        authorityAddress,
        nativeBalanceBaseUnits,
        chainState,
        holdings,
        observedRound,
    } = await adapter.fetchAccountState(address, scope, {
        priorResourceCount,
    })

    // Diff against the persisted balance row so the sync service can tell
    // whether the account changed at all this tick. ASA amount changes are
    // caught by refreshAccountHoldings below; this covers algo balance /
    // opt-in counts / status / authority.
    const balanceChanged =
        !prior ||
        prior.algoBalance.toString() !== algoBalance.toString() ||
        prior.totalAssetsOptedIn !== totalAssetsOptedIn ||
        prior.totalCreatedAssets !== totalCreatedAssets ||
        prior.totalAppsOptedIn !== totalAppsOptedIn ||
        prior.minBalance.toString() !== minBalance.toString() ||
        prior.status !== status ||
        (prior.authorityAddress ?? null) !== authorityAddress

    await upsertAccountBalance({
        accountAddress: address,
        scope,
        algoBalance,
        totalAssetsOptedIn,
        totalCreatedAssets,
        totalAppsOptedIn,
        minBalance,
        status,
        authorityAddress,
    })
    // A failed chain-state write must not skip the holdings refresh below;
    // the next sync rewrites the row.
    try {
        await upsertAccountChainState({
            accountAddress: address,
            scope,
            nativeBalance: nativeBalanceBaseUnits,
            chainData: chainState,
        })
    } catch (error) {
        logger.warn('Account chain-state write failed', {
            address,
            scope,
            error:
                error instanceof Error
                    ? { message: error.message, stack: error.stack }
                    : error,
        })
    }

    useAccountChainStateStore
        .getState()
        .setAccountChainState(scope, address, chainState)

    const holdingsChanged = await refreshAccountHoldings({
        accountAddress: address,
        holdings,
        scope,
    })

    return {
        changed: balanceChanged || holdingsChanged,
        holdingsChanged,
        observedRound,
    }
}
