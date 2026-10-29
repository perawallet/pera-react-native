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
import { Decimal } from 'decimal.js'
import {
    fetchAndPersistAssets,
    fetchAndPersistPrices,
    findNativeAsset,
} from '@perawallet/wallet-core-assets'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import {
    getAddedTokenIdsByAccount,
    upsertAccountChainState,
    refreshAccountHoldings,
    getAccountChainStateRow,
    getAccountHoldings,
    insertAssetHolding,
} from '../db'
// Imported directly (not via the hooks barrel) to avoid a module cycle:
// hooks/useEnsureAccountEnriched imports from this file.
import { invalidateAccountQueriesForAddresses } from '../hooks/querykeys'
import { accountsChainAdapters } from '../chain-adapter'
import {
    isEqualAccountChainState,
    useAccountChainStateStore,
} from '../store/accountChainState'
import { useHoldingsRefreshStore } from '../store/holdingsRefresh'

export type AccountSyncResult = {
    /** True if the chain-state row or holdings changed — drives query invalidation. */
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
// this with no chain-state row yet, firing N parallel account and holdings fetches
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
 * is no chain-state row yet. Deduped via `fetchAndPersistAccount`'s in-flight map,
 * so the summary and first holdings page collapse to one fetch.
 */
export async function ensureAccountFetched(
    address: string,
    scope: ChainScope,
): Promise<void> {
    const row = await getAccountChainStateRow({
        accountAddress: address,
        scope,
    })
    if (row) return
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
 * Always fetches, with no chain-state-row short-circuit, so a re-imported account
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
            fetchAndPersistPrices(assetIds, scope),
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

// Only after a failed first read: a read that succeeds writes the native row
// itself, and seeding ahead of it would flash 0 over a funded account. The
// failure flag tells the list this zero is a placeholder, not the balance.
async function seedUnreadNetwork(
    address: string,
    scope: ChainScope,
): Promise<void> {
    const native = findNativeAsset(scope.chainId)
    if (native) {
        await insertAssetHolding({
            accountAddress: address,
            assetId: native.assetId,
            scope,
        })
    }
    useHoldingsRefreshStore
        .getState()
        .setHoldingsRefreshFailed(scope, address, true)
}

async function doFetchAndPersistAccount(
    address: string,
    scope: ChainScope,
): Promise<AccountSyncResult> {
    // The prior row tells the chain how large the account was at its last sync
    // (which can decide its read strategy) and feeds the changed-account diff.
    const adapter = accountsChainAdapters.get(scope.chainId)
    const prior = await getAccountChainStateRow({
        accountAddress: address,
        scope,
    })

    const {
        nativeBalanceBaseUnits,
        chainState,
        holdings,
        observedRound,
        unrefreshedHoldings,
    } = await adapter
        .fetchAccountState(address, scope, {
            priorChainState: prior?.chainData,
        })
        .catch(async (error: unknown) => {
            if (!prior) {
                await seedUnreadNetwork(address, scope).catch(
                    (seedError: unknown) => {
                        logger.warn('Native holding seed failed', {
                            address,
                            scope,
                            error: seedError,
                        })
                    },
                )
            }
            throw error
        })

    // ASA amount changes are caught by refreshAccountHoldings below; this
    // covers the native balance and everything in chainState (opt-in counts,
    // status, authority).
    const isStateChanged =
        !prior ||
        !prior.nativeBalance.eq(nativeBalanceBaseUnits) ||
        !isEqualAccountChainState(prior.chainData, chainState)

    await upsertAccountChainState({
        accountAddress: address,
        scope,
        nativeBalance: nativeBalanceBaseUnits,
        chainData: chainState,
    })

    useAccountChainStateStore
        .getState()
        .setAccountChainState(scope, address, chainState)

    // Read after the chain's answer, not before it: a token added or removed
    // while that read was in flight must not be dropped or brought back.
    const addedIds =
        (
            await getAddedTokenIdsByAccount({
                accountAddresses: [address],
                scope,
            })
        ).get(address) ?? []
    const heldIds = new Set(holdings.map(({ assetId }) => assetId))
    const holdingsChanged = await refreshAccountHoldings({
        accountAddress: address,
        holdings: [
            ...holdings,
            ...addedIds
                .filter(assetId => !heldIds.has(assetId))
                .map(assetId => ({ assetId, amount: new Decimal(0) })),
        ],
        scope,
        retain:
            unrefreshedHoldings &&
            (assetId => unrefreshedHoldings.includes(assetId)),
    })
    useHoldingsRefreshStore
        .getState()
        .setHoldingsRefreshFailed(
            scope,
            address,
            unrefreshedHoldings !== undefined,
        )
    if (unrefreshedHoldings) {
        logger.warn('Account holdings partly unrefreshed', {
            address,
            scope,
            error:
                unrefreshedHoldings.error instanceof Error
                    ? {
                          message: unrefreshedHoldings.error.message,
                          stack: unrefreshedHoldings.error.stack,
                      }
                    : unrefreshedHoldings.error,
        })
    }

    return {
        changed: isStateChanged || holdingsChanged,
        holdingsChanged,
        observedRound,
    }
}
