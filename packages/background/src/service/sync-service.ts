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

import {
    useAccountsStore,
    getAllHeldAssetIdsForNetwork,
    invalidateAccountQueries,
    invalidateAccountQueriesForAddresses,
    fetchAndPersistAccount,
} from '@perawallet/wallet-core-accounts'
import {
    sendShouldRefreshRequest,
    usePollingStore,
} from '@perawallet/wallet-core-polling'
import {
    invalidateAssetQueries,
    fetchAndPersistAssets,
    fetchAndPersistPrices,
} from '@perawallet/wallet-core-assets'
import {
    invalidateTransactionQueries,
    fetchAndPersistTransactions,
} from '@perawallet/wallet-core-transactions'
import {
    logger,
    calculateBackoff,
    type Network,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import type { SyncServiceDeps } from '../models'

const POLL_INTERVAL = 3000
const MAX_BACKOFF_INTERVAL = 30_000
const BACKOFF_MULTIPLIER = 2

// Asset metadata has a long TTL and only new assets need fetching — and new
// assets only appear when holdings change (handled immediately). This interval
// is just a safety net to re-run the staleness check periodically; the
// per-tick whole-portfolio reads are otherwise skipped.
const ASSET_RESYNC_INTERVAL_MS = 10 * 60 * 1000
// Prices move, so refresh periodically even when holdings are unchanged. The
// re-price still walks all held ids (a follow-up will narrow this to assets
// that already carry a price via a join-based staleness check), so keep the
// cadence modest rather than per-tick.
const PRICE_RESYNC_INTERVAL_MS = 60 * 1000

export class SyncService {
    private timer: Nullable<ReturnType<typeof setTimeout>> = null
    private running = false
    private hasCompletedInitialSync = false
    private currentInterval = POLL_INTERVAL
    // Per-network timestamps of the last asset-metadata / price passes, so the
    // expensive whole-portfolio reads only run when holdings changed or the
    // coarse interval elapsed — not on every poll tick.
    private lastAssetSyncAt = new Map<Network, number>()
    private lastPriceSyncAt = new Map<Network, number>()
    // Coalesce query invalidations. invalidateAccountQueries fans out to every
    // mounted balance/summary/list query (a wide read each), so firing it
    // repeatedly in quick succession (back-to-back phases, rapid ticks) stacks
    // up redundant full re-reads on the single DB connection. A short trailing
    // debounce collapses bursts into one refetch pass.
    private invalidateTimers = new Map<string, ReturnType<typeof setTimeout>>()
    // Guards against overlapping syncs. The poll loop self-reschedules (next
    // tick only after the current completes), but restart()/manual triggers
    // could otherwise start a second syncAll while a long fresh-import sync is
    // still running — stacking concurrent work on the DB.
    private syncInProgress = false

    constructor(private readonly deps: SyncServiceDeps) {}

    private debouncedInvalidate(
        key: string,
        run: () => void,
        delayMs = 250,
    ): void {
        const existing = this.invalidateTimers.get(key)
        if (existing) clearTimeout(existing)
        this.invalidateTimers.set(
            key,
            setTimeout(() => {
                this.invalidateTimers.delete(key)
                run()
            }, delayMs),
        )
    }

    start(): void {
        if (this.running) return
        this.running = true
        void this.tick()
    }

    stop(): void {
        this.running = false
        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }
        this.invalidateTimers.forEach(t => clearTimeout(t))
        this.invalidateTimers.clear()
    }

    restart(): void {
        this.stop()
        this.hasCompletedInitialSync = false
        this.currentInterval = POLL_INTERVAL
        this.start()
    }

    isRunning(): boolean {
        return this.running
    }

    private async tick(): Promise<void> {
        // A sync is already running (e.g. a long fresh-import sync that outlived
        // its tick, or an overlapping restart). Skip — the in-progress tick's
        // finally reschedules, so the loop is preserved without stacking.
        if (this.syncInProgress) return
        this.syncInProgress = true

        try {
            const activeNetwork = useNetworkStore.getState().network
            let networksToSync: Network[]
            let shouldRefreshRound: Nullable<number> = null

            if (!this.hasCompletedInitialSync) {
                // First tick: force-sync the active network to ensure DB is populated
                networksToSync = [activeNetwork]
                this.hasCompletedInitialSync = true
            } else {
                const check = await this.checkShouldRefresh(activeNetwork)
                networksToSync = check.networks
                shouldRefreshRound = check.round
            }

            if (networksToSync.length > 0) {
                await this.syncAll(networksToSync, shouldRefreshRound)
            }

            // Reset interval on success
            this.currentInterval = POLL_INTERVAL
        } catch (error) {
            logger.warn('Sync tick failed', { error })
            // Back off on errors to avoid hammering a rate-limited API
            this.currentInterval = calculateBackoff(
                this.currentInterval,
                BACKOFF_MULTIPLIER,
                MAX_BACKOFF_INTERVAL,
            )
        } finally {
            this.syncInProgress = false
            this.scheduleNextTick()
        }
    }

    private scheduleNextTick(): void {
        if (!this.running) return
        this.timer = setTimeout(() => void this.tick(), this.currentInterval)
    }

    /**
     * Ask the backend whether any watched address has activity newer than the
     * checkpoint. Deliberately does NOT advance the checkpoint here — that
     * happens in {@link advanceLastRefreshedRound} only after the sync pass
     * actually observed the new state. Advancing up front loses updates: if
     * the data source still lags the backend-reported round when we read it,
     * every subsequent tick asks "anything since round R?" and is told no,
     * so the stale balances stick until unrelated on-chain activity.
     */
    private async checkShouldRefresh(
        activeNetwork: Network,
    ): Promise<{ networks: Network[]; round: Nullable<number> }> {
        const accounts = useAccountsStore.getState().accounts
        const addresses = accounts.map(a => a.address)

        if (addresses.length === 0) return { networks: [], round: null }

        const { lastRefreshedRound } = usePollingStore.getState()

        const neverSynced = lastRefreshedRound[activeNetwork] === null

        try {
            const result = await sendShouldRefreshRequest(
                activeNetwork,
                addresses,
                lastRefreshedRound[activeNetwork],
            )

            if (result.refresh || neverSynced) {
                return {
                    networks: [activeNetwork],
                    round: result.round ?? null,
                }
            }
        } catch {
            if (neverSynced) {
                return { networks: [activeNetwork], round: null }
            }
        }

        return { networks: [], round: null }
    }

    /**
     * Move the should-refresh checkpoint forward after an account pass.
     *
     * Only advances when every account fetch succeeded — a failed fetch means
     * that account's new state was not persisted, so the checkpoint must stay
     * put and the next tick retries. Advances to the minimum round the
     * fetches observed (state at round X covers all activity ≤ X), falling
     * back to the backend-reported round only when no fetch reported one.
     * If the observed round still trails the backend's, the next tick's
     * should-refresh answers yes again and the sync retries until the data
     * source catches up.
     */
    private advanceLastRefreshedRound(
        network: Network,
        accountResults: PromiseSettledResult<
            Awaited<ReturnType<typeof fetchAndPersistAccount>>
        >[],
        fallbackRound: Nullable<number>,
    ): void {
        if (accountResults.length === 0) return
        if (accountResults.some(r => r.status === 'rejected')) return

        const observedRounds = accountResults
            .map(r =>
                r.status === 'fulfilled'
                    ? (r.value?.observedRound ?? null)
                    : null,
            )
            .filter((round): round is number => round !== null)

        const round =
            observedRounds.length > 0
                ? Math.min(...observedRounds)
                : fallbackRound
        if (round === null) return

        usePollingStore.getState().setLastRefreshedRound(network, round)
    }

    private async syncAll(
        networks: Network[],
        shouldRefreshRound: Nullable<number> = null,
    ): Promise<void> {
        const accounts = useAccountsStore.getState().accounts
        let hasRateLimitError = false

        for (const network of networks) {
            // 1. Sync all accounts in parallel (each failure isolated)
            const accountResults = await Promise.allSettled(
                accounts.map(a => fetchAndPersistAccount(a.address, network)),
            )
            this.logFailures(
                'account',
                accountResults,
                network,
                i => accounts[i]?.address,
            )
            if (this.hasRateLimitFailure(accountResults)) {
                hasRateLimitError = true
            }

            // The checkpoint only moves once this pass has demonstrably
            // persisted state covering it — see advanceLastRefreshedRound.
            this.advanceLastRefreshedRound(
                network,
                accountResults,
                shouldRefreshRound,
            )

            // Only invalidate the accounts whose balance/holdings actually
            // changed — invalidation forces a wide DB re-read per account, so
            // skipping unchanged accounts (the common tick) avoids redundant
            // reads on the single connection.
            const changedAddresses = accounts
                .map((a, i) => {
                    const r = accountResults[i]
                    return r.status === 'fulfilled' && r.value?.changed
                        ? a.address
                        : null
                })
                .filter((address): address is string => address !== null)
            const anyHoldingsChanged = accountResults.some(
                r => r.status === 'fulfilled' && r.value?.holdingsChanged,
            )
            if (changedAddresses.length > 0) {
                this.debouncedInvalidate('accounts', () =>
                    invalidateAccountQueriesForAddresses(
                        this.deps.queryClient,
                        changedAddresses,
                    ),
                )
            }

            // 2. Asset metadata + prices. The whole-portfolio reads are
            // expensive for large accounts, so only run them when holdings
            // changed (new assets may need fetching / re-pricing) or the coarse
            // per-pass interval has elapsed — not on every poll tick.
            const nowMs = Date.now()
            const syncAssets =
                anyHoldingsChanged ||
                nowMs - (this.lastAssetSyncAt.get(network) ?? 0) >=
                    ASSET_RESYNC_INTERVAL_MS
            const syncPrices =
                anyHoldingsChanged ||
                nowMs - (this.lastPriceSyncAt.get(network) ?? 0) >=
                    PRICE_RESYNC_INTERVAL_MS

            if (syncAssets || syncPrices) {
                // Prices are always fetched from mainnet (inside
                // fetchAndPersistPrices) but stored under the active network so
                // DB JOINs line up.
                const assetIds = await getAllHeldAssetIdsForNetwork({ network })
                const tasks: Array<{
                    kind: 'assets' | 'prices'
                    run: () => Promise<void>
                }> = []
                if (syncAssets) {
                    tasks.push({
                        kind: 'assets',
                        run: () => fetchAndPersistAssets(assetIds, network),
                    })
                }
                if (syncPrices) {
                    tasks.push({
                        kind: 'prices',
                        run: () => fetchAndPersistPrices(assetIds, network),
                    })
                }

                const assetResults = await Promise.allSettled(
                    tasks.map(t => t.run()),
                )
                this.logFailures(
                    'asset-metadata-or-prices',
                    assetResults,
                    network,
                    i => tasks[i]?.kind,
                )
                if (this.hasRateLimitFailure(assetResults)) {
                    hasRateLimitError = true
                }
                // Record each pass as done only on success, so a failed pass
                // retries next tick instead of waiting out the interval.
                assetResults.forEach((r, i) => {
                    if (r.status !== 'fulfilled') return
                    if (tasks[i].kind === 'assets') {
                        this.lastAssetSyncAt.set(network, nowMs)
                    } else {
                        this.lastPriceSyncAt.set(network, nowMs)
                    }
                })
                // Invalidate so asset rows and prices appear as soon as metadata
                // is ready. Skip when every batch was rejected. Account queries
                // are invalidated too: the balance/holdings read joins in asset
                // metadata + price, so it must refetch when those change — and
                // any account may hold the newly-synced assets, so this one is
                // necessarily broad.
                if (assetResults.some(r => r.status === 'fulfilled')) {
                    this.debouncedInvalidate('assets', () =>
                        invalidateAssetQueries(this.deps.queryClient),
                    )
                    this.debouncedInvalidate('accounts-assets', () =>
                        invalidateAccountQueries(this.deps.queryClient),
                    )
                }
            }

            // 4. Sync recent transactions for each account
            const txResults = await Promise.allSettled(
                accounts.map(a =>
                    fetchAndPersistTransactions(a.address, network),
                ),
            )
            this.logFailures(
                'transactions',
                txResults,
                network,
                i => accounts[i]?.address,
            )
            if (this.hasRateLimitFailure(txResults)) {
                hasRateLimitError = true
            }
            // Invalidate so the transaction list reflects the latest state.
            // Skip when every account's fetch was rejected — invalidation
            // forces a re-read from DB with no new data to surface.
            if (txResults.some(r => r.status === 'fulfilled')) {
                this.debouncedInvalidate('transactions', () =>
                    invalidateTransactionQueries(this.deps.queryClient),
                )
            }
        }

        if (hasRateLimitError) {
            throw new Error('Rate limited by API')
        }
    }

    private logFailures(
        phase: string,
        results: PromiseSettledResult<unknown>[],
        network: Network,
        subject: (index: number) => Optional<string>,
    ): void {
        results.forEach((result, index) => {
            if (result.status !== 'rejected') return
            // Rate limits are handled separately via backoff — skip noise.
            if (
                result.reason instanceof Error &&
                result.reason.message.includes('429')
            ) {
                return
            }
            logger.warn('Sync step failed', {
                phase,
                network,
                subject: subject(index),
                error:
                    result.reason instanceof Error
                        ? {
                              message: result.reason.message,
                              stack: result.reason.stack,
                          }
                        : result.reason,
            })
        })
    }

    private hasRateLimitFailure(
        results: PromiseSettledResult<unknown>[],
    ): boolean {
        return results.some(
            r =>
                r.status === 'rejected' &&
                r.reason instanceof Error &&
                r.reason.message.includes('429'),
        )
    }

    invalidateQueries(): void {
        invalidateAccountQueries(this.deps.queryClient)
        invalidateAssetQueries(this.deps.queryClient)
        invalidateTransactionQueries(this.deps.queryClient)
    }

    /**
     * Targeted refresh for a specific set of addresses on a specific network.
     * Pulls fresh account info and recent transactions for each address from
     * the indexer, persists to the local DB, and invalidates the related
     * query caches so observers re-read the new state.
     *
     * Used by post-submission auto-refresh paths (see
     * `submitAndAutoRefresh` in @perawallet/wallet-core-signing) to update
     * sender/receiver balances as soon as a transaction confirms, without
     * waiting for the next periodic tick. Failures are logged but never
     * thrown — the periodic tick is the safety net.
     */
    async refreshAccounts(
        addresses: string[],
        network: Network,
    ): Promise<void> {
        if (addresses.length === 0) return

        const accountResults = await Promise.allSettled(
            addresses.map(a => fetchAndPersistAccount(a, network)),
        )
        const txResults = await Promise.allSettled(
            addresses.map(a => fetchAndPersistTransactions(a, network)),
        )

        this.logFailures(
            'refresh-accounts',
            accountResults,
            network,
            i => addresses[i],
        )
        this.logFailures(
            'refresh-transactions',
            txResults,
            network,
            i => addresses[i],
        )

        // New holdings (e.g. a swap into a not-opted-in asset) land here without
        // asset metadata or prices, so the asset-list row has no
        // decimals/totalSupply and renders a skeleton until the next coarse
        // asset-resync tick. Enrich immediately when holdings changed, mirroring
        // syncAll's holdingsChanged branch — otherwise the periodic tick sees the
        // holding already persisted (holdingsChanged === false) and won't fetch
        // metadata until the 10-minute interval elapses.
        const anyHoldingsChanged = accountResults.some(
            r => r.status === 'fulfilled' && r.value?.holdingsChanged,
        )
        if (anyHoldingsChanged) {
            // Kept self-contained so a DB/read failure here can't skip the
            // account/transaction invalidations below — refreshAccounts logs
            // but never throws (the periodic tick is the safety net).
            try {
                const assetIds = await getAllHeldAssetIdsForNetwork({ network })
                const assetResults = await Promise.allSettled([
                    fetchAndPersistAssets(assetIds, network),
                    fetchAndPersistPrices(assetIds, network),
                ])
                this.logFailures(
                    'refresh-asset-metadata-or-prices',
                    assetResults,
                    network,
                    i => (i === 0 ? 'assets' : 'prices'),
                )
                if (assetResults.some(r => r.status === 'fulfilled')) {
                    invalidateAssetQueries(this.deps.queryClient)
                }
            } catch (error) {
                logger.warn('Refresh asset enrichment failed', {
                    network,
                    error:
                        error instanceof Error
                            ? { message: error.message, stack: error.stack }
                            : error,
                })
            }
        }

        invalidateAccountQueries(this.deps.queryClient)
        invalidateTransactionQueries(this.deps.queryClient)
    }
}
