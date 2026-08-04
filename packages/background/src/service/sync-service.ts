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

import { isHTTPError } from 'ky'
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
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { onlineManager } from '@tanstack/react-query'
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
// Must stay above PRICE_CACHE_TTL_MS in packages/assets price-syncer, or the
// TTL gate would classify every periodic pass as fresh and stop re-pricing.
const PRICE_RESYNC_INTERVAL_MS = 60 * 1000

export class SyncService {
    private timer: Nullable<ReturnType<typeof setTimeout>> = null
    private running = false
    private hasCompletedInitialSync = false
    // Set once should-refresh gets a 401/403: the key is wrong/missing, a
    // config-level problem retrying every tick can't fix. Reset on
    // start()/restart() so a rebuilt or reconfigured session recovers.
    private hasAuthError = false
    private currentInterval: number
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
    // Unsubscribe handle for the onlineManager connectivity subscription, set
    // while running so an offline→online transition can trigger an immediate
    // tick. Cleared on stop() so the subscription lifecycle tracks running.
    private onlineUnsubscribe: Nullable<() => void> = null
    private readonly baseInterval: number

    constructor(private readonly deps: SyncServiceDeps) {
        this.baseInterval = deps.pollIntervalMs ?? POLL_INTERVAL
        this.currentInterval = this.baseInterval
    }

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
        // Subscribe once (per running session) so a reconnect wakes the loop
        // immediately instead of waiting out the current interval. Unsubscribed
        // in stop(), so this only fires while the service is meant to be polling.
        this.onlineUnsubscribe ??= onlineManager.subscribe(isOnline => {
            if (isOnline) this.handleReconnect()
        })
        this.hasAuthError = false
        void this.tick()
    }

    stop(): void {
        this.running = false
        if (this.onlineUnsubscribe !== null) {
            this.onlineUnsubscribe()
            this.onlineUnsubscribe = null
        }
        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }
        this.invalidateTimers.forEach(t => clearTimeout(t))
        this.invalidateTimers.clear()
    }

    /**
     * Run a sync tick immediately after an offline→online transition, rather
     * than waiting out the scheduled interval. Respects the syncInProgress
     * guard (a running tick's finally reschedules) and cancels any pending
     * offline-scheduled timer so the reconnect tick isn't duplicated.
     */
    private handleReconnect(): void {
        if (!this.running || this.syncInProgress) return
        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }
        void this.tick()
    }

    restart(): void {
        this.stop()
        this.hasCompletedInitialSync = false
        this.currentInterval = this.baseInterval
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

        // Connectivity gate: while offline, perform zero network work — no
        // should-refresh POST, no syncAll. The loop stays cheaply scheduled so
        // it resumes on its own, and the online-transition listener (subscribed
        // in start) triggers an immediate tick on reconnect (Part A / Part D).
        if (!onlineManager.isOnline()) {
            this.scheduleNextTick()
            return
        }

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
                const { hadTotalFailure, hadAccountFailure } =
                    await this.syncAll(networksToSync, shouldRefreshRound)
                // Back off when the tick made no progress at all, or when an
                // account fetch failed — the frozen checkpoint means the next
                // tick re-syncs the whole network, so pace those retries.
                // A clean tick, or one with no work to do, resets to base.
                this.currentInterval =
                    hadTotalFailure || hadAccountFailure
                        ? calculateBackoff(
                              this.currentInterval,
                              BACKOFF_MULTIPLIER,
                              MAX_BACKOFF_INTERVAL,
                          )
                        : this.baseInterval
            } else {
                // No networks needed syncing (should-refresh reported no work,
                // or there are no accounts) — a successful, cheap tick.
                this.currentInterval = this.baseInterval
            }
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

        // `?? null` treats a network absent from the (partial) persisted map
        // the same as one explicitly recorded as never-synced — both must
        // force-sync below, rather than an absent key silently reading as
        // "already synced" (undefined !== null).
        const neverSynced = (lastRefreshedRound[activeNetwork] ?? null) === null

        // Networks with no Pera deployment (betanet, custom) have no should-refresh
        // endpoint to consult — the request throws PeraServiceUnavailableError every
        // tick. Returning the active network here keeps chain sync alive: algod and
        // indexer need no Pera service and are the only sources these networks have.
        // Checked BEFORE the request so the tick never pays for a throw that cannot
        // succeed, and never reaches the rethrow below that engages backoff.
        if (!isPeraBackedNetwork(activeNetwork)) {
            return { networks: [activeNetwork], round: null }
        }

        // A prior tick's should-refresh request got 401/403 (BACKEND_API_KEY
        // is wrong/missing) — skip re-issuing that request until
        // start()/restart(). This backs off the should-refresh REQUEST only:
        // algod/indexer use separate credentials (ALGOD_API_KEY/
        // INDEXER_API_KEY), so a never-synced network still needs its
        // force-sync fallback below — including a network the user switches
        // to after the flag is already set.
        if (this.hasAuthError) {
            return neverSynced
                ? { networks: [activeNetwork], round: null }
                : { networks: [], round: null }
        }

        try {
            const result = await sendShouldRefreshRequest(
                activeNetwork,
                addresses,
                lastRefreshedRound[activeNetwork] ?? null,
            )

            if (result.refresh || neverSynced) {
                return {
                    networks: [activeNetwork],
                    round: result.round ?? null,
                }
            }
        } catch (error) {
            const status = isHTTPError(error) ? error.response?.status : null
            const isAuthError = status === 401 || status === 403
            if (isAuthError) {
                this.hasAuthError = true
                logger.warn(
                    'Should-refresh rejected as unauthorized — check BACKEND_API_KEY is set (see apps/extension/README.md)',
                    { status },
                )
            }
            // Check neverSynced before the auth branch: a never-synced
            // network must force-sync regardless of the backend 401 — see
            // the hasAuthError guard's comment above.
            if (neverSynced) {
                return { networks: [activeNetwork], round: null }
            }
            if (isAuthError) {
                return { networks: [], round: null }
            }
            // Rethrow so the tick's catch engages backoff — swallowing here
            // kept a persistently failing should-refresh retrying at the base
            // 3 s interval forever.
            throw error
        }

        return { networks: [], round: null }
    }

    /**
     * Move the should-refresh checkpoint forward after an account pass.
     *
     * Only advances when every account fetch succeeded: the checkpoint is
     * per-network, so advancing past a failed account's unfetched rounds
     * would leave it stale until its next on-chain activity. The retry storm
     * this used to cause is bounded elsewhere — a partial failure now feeds
     * the tick backoff (see syncAll/tick) instead of freezing at the base
     * poll cadence. On a clean pass, advances to the minimum round the
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

        const observedRounds = accountResults
            .map(r =>
                r.status === 'fulfilled'
                    ? (r.value?.observedRound ?? null)
                    : null,
            )
            .filter((round): round is number => round !== null)

        // A rejected fetch freezes the checkpoint: its account's state was
        // not persisted, so moving forward would skip that account's rounds.
        // The bounded retry lives in the tick backoff, not here.
        const anyRejected = accountResults.some(r => r.status === 'rejected')
        if (anyRejected) return

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
    ): Promise<{ hadTotalFailure: boolean; hadAccountFailure: boolean }> {
        const accounts = useAccountsStore.getState().accounts
        let hasRateLimitError = false
        // Rejections freeze the checkpoint (see advanceLastRefreshedRound), so
        // the caller must back off or it re-syncs the whole network every tick.
        let hadAccountFailure = false
        // Tracked across all phases because allSettled absorbs non-429 failures,
        // so syncAll can make zero progress without ever throwing.
        let hadAnySuccess = false
        let hadAnyFailure = false
        const recordOutcomes = (results: PromiseSettledResult<unknown>[]) => {
            if (results.some(r => r.status === 'fulfilled'))
                hadAnySuccess = true
            if (results.some(r => r.status === 'rejected')) hadAnyFailure = true
        }

        for (const network of networks) {
            // 1. Sync all accounts in parallel (each failure isolated)
            const accountResults = await Promise.allSettled(
                accounts.map(a => fetchAndPersistAccount(a.address, network)),
            )
            recordOutcomes(accountResults)
            if (accountResults.some(r => r.status === 'rejected')) {
                hadAccountFailure = true
            }
            this.logFailures(
                'account',
                accountResults,
                network,
                i => accounts[i]?.address,
            )
            if (this.hasRateLimitFailure(accountResults)) {
                hasRateLimitError = true
            }

            // Only moves once this pass has demonstrably persisted state
            // covering it — see advanceLastRefreshedRound.
            this.advanceLastRefreshedRound(
                network,
                accountResults,
                shouldRefreshRound,
            )

            // Invalidation forces a wide DB re-read per account, so skip the
            // unchanged ones — which is the common tick.
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
            // expensive, so gate them on a holdings change or the coarse
            // interval rather than running every tick.
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
                // Fetched and stored under the active network so DB JOINs line up.
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
                recordOutcomes(assetResults)
                this.logFailures(
                    'asset-metadata-or-prices',
                    assetResults,
                    network,
                    i => tasks[i]?.kind,
                )
                if (this.hasRateLimitFailure(assetResults)) {
                    hasRateLimitError = true
                }
                // Only on success, so a failed pass retries next tick instead of
                // waiting out the interval.
                assetResults.forEach((r, i) => {
                    if (r.status !== 'fulfilled') return
                    if (tasks[i].kind === 'assets') {
                        this.lastAssetSyncAt.set(network, nowMs)
                    } else {
                        this.lastPriceSyncAt.set(network, nowMs)
                    }
                })
                // Skipped when every batch was rejected. Account queries go too:
                // the balance/holdings read joins in metadata + price, and any
                // account may hold the new assets, so this one is necessarily
                // broad.
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
            recordOutcomes(txResults)
            this.logFailures(
                'transactions',
                txResults,
                network,
                i => accounts[i]?.address,
            )
            if (this.hasRateLimitFailure(txResults)) {
                hasRateLimitError = true
            }
            // Skipped when every fetch was rejected — invalidation forces a DB
            // re-read with no new data to surface.
            if (txResults.some(r => r.status === 'fulfilled')) {
                this.debouncedInvalidate('transactions', () =>
                    invalidateTransactionQueries(this.deps.queryClient),
                )
            }
        }

        if (hasRateLimitError) {
            throw new Error('Rate limited by API')
        }

        return {
            hadTotalFailure: hadAnyFailure && !hadAnySuccess,
            hadAccountFailure,
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
     * sender/receiver balances as soon as a transaction confirms, and by
     * pull-to-refresh, without waiting for the next periodic tick. Failures
     * are logged but never thrown — the periodic tick is the safety net.
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

        // New holdings land here with no metadata or price, so the asset row
        // renders a skeleton. Enrich immediately rather than waiting for the
        // coarse tick, which by then sees the holding already persisted
        // (holdingsChanged === false) and won't fetch until the interval elapses.
        const anyHoldingsChanged = accountResults.some(
            r => r.status === 'fulfilled' && r.value?.holdingsChanged,
        )
        if (anyHoldingsChanged) {
            // Self-contained so a read failure here can't skip the invalidations
            // below. refreshAccounts logs but never throws.
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
