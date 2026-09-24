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

import { onlineManager } from '@tanstack/react-query'
import { isHTTPError } from 'ky'
import {
    invalidateAccountQueries,
    invalidateAccountQueriesForAddresses,
} from '@perawallet/wallet-core-accounts'
import { sendShouldRefreshRequest } from '@perawallet/wallet-core-polling'
import { invalidateAssetQueries } from '@perawallet/wallet-core-assets'
import {
    invalidateTransactionQueries,
    invalidateTransactionQueriesForAddresses,
} from '@perawallet/wallet-core-transactions'
import {
    logger,
    calculateBackoff,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { reconcileOpenSubmissions } from '@perawallet/wallet-core-signing'
import type { SyncServiceDeps } from '../models'
import {
    resolveCheckpointRound,
    syncAccountsPhase,
    syncAssetsPhase,
    syncTransactionsPhase,
    type AssetSyncKind,
    type SyncPhaseResult,
} from './sync-phases'

const POLL_INTERVAL = 3000
const MAX_BACKOFF_INTERVAL = 30_000
const BACKOFF_MULTIPLIER = 2

/** How often a paused tick re-checks. Only a counter read, so keep it snappy. */
const PAUSE_RECHECK_MS = 400

/**
 * Hard ceiling on a pause, after which sync resumes regardless of whether the
 * matching `resume()` ever arrived.
 *
 * The safety net for an unbalanced pause — a list unmounted mid-scroll, a
 * gesture whose end event never fires. Without it, one dropped `resume()` stops
 * background sync for the rest of the process. Expiry force-clears the count
 * rather than decrementing it, so a leak cannot accumulate across pauses.
 */
const MAX_PAUSE_MS = 5000

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
    private invalidateTimers = new Map<
        string,
        { timer: ReturnType<typeof setTimeout>; run: () => void }
    >()
    // Guards against overlapping syncs. The poll loop self-reschedules (next
    // tick only after the current completes), but restart()/manual triggers
    // could otherwise start a second syncAll while a long fresh-import sync is
    // still running — stacking concurrent work on the DB.
    private syncInProgress = false
    // Ref-counted pause depth, and the ceiling timer that recovers from a
    // pause whose resume() never arrived. See pause().
    private pauseCount = 0
    private pauseDeadlineTimer: Nullable<ReturnType<typeof setTimeout>> = null
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
        if (existing) clearTimeout(existing.timer)
        this.invalidateTimers.set(key, {
            run,
            timer: setTimeout(() => {
                this.invalidateTimers.delete(key)
                run()
            }, delayMs),
        })
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
        // Flush, don't drop: the writes these notify about are already in
        // SQLite, and the next tick diffs against that persisted state — so a
        // discarded notification leaves every mounted query stale until app
        // restart (nothing ever re-flags the account as changed).
        this.invalidateTimers.forEach(({ timer, run }) => {
            clearTimeout(timer)
            run()
        })
        this.invalidateTimers.clear()
        // A pause does not survive the service it was holding off. Leaving the
        // count set would carry into the next start() and suppress its first
        // ticks, with no caller left to resume.
        this.clearPauseDeadline()
        this.pauseCount = 0
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

    isPaused(): boolean {
        return this.pauseCount > 0
    }

    /**
     * Asks the poll loop to hold off — for a caller that owns the JS thread for
     * a while, chiefly a list being scrolled (see `pauseSyncOnInteraction` on
     * PWFlatList). Cheap and safe to call whether or not sync is running.
     *
     * Ref-counted, because several such lists can be mounted at once (the
     * account tabs all stay mounted) and a plain flag would let one caller's
     * `resume()` cancel another's pause. Every `pause()` must be matched by a
     * `resume()`; {@link MAX_PAUSE_MS} covers the case where one isn't.
     */
    pause(): void {
        this.pauseCount++
        this.armPauseDeadline()
    }

    /** Balances one `pause()`. Extra calls are ignored rather than going negative. */
    resume(): void {
        if (this.pauseCount === 0) return
        this.pauseCount--
        if (this.pauseCount === 0) {
            this.clearPauseDeadline()
        }
    }

    /**
     * (Re-)arms from the most recent `pause()`, so the ceiling measures time
     * since the last pause rather than the first — nested or overlapping pauses
     * each get the full window instead of inheriting a spent one.
     */
    private armPauseDeadline(): void {
        this.clearPauseDeadline()
        this.pauseDeadlineTimer = setTimeout(() => {
            this.pauseDeadlineTimer = null
            // Force to zero, not a decrement: the point is to recover from a
            // caller that never resumed, and decrementing would leave the leak
            // in place.
            const abandoned = this.pauseCount
            this.pauseCount = 0
            logger.debug('Sync pause expired without resume', { abandoned })
        }, MAX_PAUSE_MS)
    }

    private clearPauseDeadline(): void {
        if (this.pauseDeadlineTimer !== null) {
            clearTimeout(this.pauseDeadlineTimer)
            this.pauseDeadlineTimer = null
        }
    }

    private async tick(): Promise<void> {
        // A sync is already running (e.g. a long fresh-import sync that outlived
        // its tick, or an overlapping restart). Skip — the in-progress tick's
        // finally reschedules, so the loop is preserved without stacking.
        if (this.syncInProgress) return

        // Connectivity gate: while offline, perform zero network work — no
        // should-refresh POST, no syncAll. The loop stays cheaply scheduled so
        // it resumes on its own, and the online-transition listener (subscribed
        // in start) triggers an immediate tick on reconnect.
        if (!onlineManager.isOnline()) {
            this.scheduleNextTick()
            return
        }

        // Paused by a caller — see pause(). A tick persists to SQLite once per
        // account per phase, and that work lands on the same JS thread a scroll
        // is being rendered on; a hitch mid-gesture is far more noticeable than
        // a list that is a moment staler.
        //
        // Rescheduled at the recheck interval rather than the poll interval, so
        // sync resumes promptly on unpause, and without touching
        // `currentInterval` — a pause is not a failure and must not feed the
        // backoff.
        if (this.isPaused()) {
            this.scheduleNextTick(PAUSE_RECHECK_MS)
            return
        }

        // Claimed before the first await below: the reconcile pass issues
        // network probes, and a reconnect landing mid-pass would otherwise
        // pass handleReconnect's guard and start a second overlapping tick.
        this.syncInProgress = true

        try {
            // Settle open submission-attempt rows before the sync
            // phases. Piggybacks the tick's online gate and cadence — the pass
            // is bounded, a no-op when nothing is open, and never throws.
            const reconcileSummary = await reconcileOpenSubmissions()
            if (reconcileSummary.confirmed + reconcileSummary.failed > 0) {
                // A settled row changes the "pending — verifying" badge set and
                // must drop the pending history entry (history queries are
                // DB-cached with staleTime: Infinity, so a settle on a no-work
                // tick would otherwise leave a resolved row showing).
                // Covers the badge set too — its key sits under the same
                // module prefix.
                invalidateTransactionQueries(this.deps.queryClient)
            }

            const activeNetwork = this.deps.stores.getActiveNetwork()
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

    /** `delayMs` overrides the current interval without disturbing backoff. */
    private scheduleNextTick(delayMs?: number): void {
        if (!this.running) return
        this.timer = setTimeout(
            () => void this.tick(),
            delayMs ?? this.currentInterval,
        )
    }

    /**
     * Ask the backend whether any watched address has activity newer than the
     * checkpoint. Deliberately does NOT advance the checkpoint here — that
     * happens in syncAll (see resolveCheckpointRound) only after the sync pass
     * actually observed the new state. Advancing up front loses updates: if
     * the data source still lags the backend-reported round when we read it,
     * every subsequent tick asks "anything since round R?" and is told no,
     * so the stale balances stick until unrelated on-chain activity.
     */
    private async checkShouldRefresh(
        activeNetwork: Network,
    ): Promise<{ networks: Network[]; round: Nullable<number> }> {
        const addresses = this.deps.stores.getAccountAddresses()

        if (addresses.length === 0) return { networks: [], round: null }

        const lastRefreshedRound =
            this.deps.stores.getLastRefreshedRound(activeNetwork)
        const neverSynced = lastRefreshedRound === null

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
                lastRefreshedRound,
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
                    'Should-refresh rejected as unauthorized — check BACKEND_API_KEY is set (see apps/browser/README.md)',
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

    // Phase order matters: the checkpoint advances off the account pass, and
    // the asset gate reads that pass's holdings change.
    private async syncAll(
        networks: Network[],
        shouldRefreshRound: Nullable<number> = null,
    ): Promise<{ hadTotalFailure: boolean; hadAccountFailure: boolean }> {
        const addresses = this.deps.stores.getAccountAddresses()
        let hasRateLimitError = false
        // Rejections freeze the checkpoint (see resolveCheckpointRound), so
        // the caller must back off or it re-syncs the whole network every tick.
        let hadAccountFailure = false
        // Tracked across all phases because allSettled absorbs non-429 failures,
        // so syncAll can make zero progress without ever throwing.
        let hadAnySuccess = false
        let hadAnyFailure = false
        const recordOutcome = (phase: SyncPhaseResult<unknown>) => {
            if (phase.hasSuccess) hadAnySuccess = true
            if (phase.hasFailure) hadAnyFailure = true
            if (phase.isRateLimited) hasRateLimitError = true
        }

        for (const network of networks) {
            const accountPass = await syncAccountsPhase(
                addresses,
                network,
                'account',
            )
            recordOutcome(accountPass)
            if (accountPass.hasFailure) hadAccountFailure = true

            const round = resolveCheckpointRound(
                accountPass.results,
                shouldRefreshRound,
            )
            if (round !== null) {
                this.deps.stores.setLastRefreshedRound(network, round)
            }

            // Invalidation forces a wide DB re-read per account, so skip the
            // unchanged ones — which is the common tick.
            const { changedAddresses } = accountPass
            if (changedAddresses.length > 0) {
                this.debouncedInvalidate('accounts', () =>
                    invalidateAccountQueriesForAddresses(
                        this.deps.queryClient,
                        changedAddresses,
                    ),
                )
            }

            const nowMs = Date.now()
            const dueKinds = this.dueAssetKinds(
                network,
                nowMs,
                accountPass.hasHoldingsChanged,
            )
            if (dueKinds.length > 0) {
                const assetPass = await syncAssetsPhase(
                    network,
                    dueKinds,
                    'asset-metadata-or-prices',
                )
                recordOutcome(assetPass)
                // Only on success, so a failed pass retries next tick instead of
                // waiting out the interval.
                for (const kind of assetPass.succeededKinds) {
                    const lastSyncAt =
                        kind === 'assets'
                            ? this.lastAssetSyncAt
                            : this.lastPriceSyncAt
                    lastSyncAt.set(network, nowMs)
                }
                // Skipped when every batch was rejected. Account queries go too:
                // the balance/holdings read joins in metadata + price, and any
                // account may hold the new assets, so this one is necessarily
                // broad.
                if (assetPass.hasSuccess) {
                    this.debouncedInvalidate('assets', () =>
                        invalidateAssetQueries(this.deps.queryClient),
                    )
                    this.debouncedInvalidate('accounts-assets', () =>
                        invalidateAccountQueries(this.deps.queryClient),
                    )
                }
            }

            const txPass = await syncTransactionsPhase(
                addresses,
                network,
                'transactions',
            )
            recordOutcome(txPass)
            // Skipped when every fetch was rejected — invalidation forces a DB
            // re-read with no new data to surface.
            if (txPass.hasSuccess) {
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

    // The whole-portfolio asset reads are expensive, so each kind runs on a
    // holdings change or once its coarse interval has elapsed, not every tick.
    private dueAssetKinds(
        network: Network,
        nowMs: number,
        hasHoldingsChanged: boolean,
    ): AssetSyncKind[] {
        const kinds: AssetSyncKind[] = []
        if (
            hasHoldingsChanged ||
            nowMs - (this.lastAssetSyncAt.get(network) ?? 0) >=
                ASSET_RESYNC_INTERVAL_MS
        ) {
            kinds.push('assets')
        }
        if (
            hasHoldingsChanged ||
            nowMs - (this.lastPriceSyncAt.get(network) ?? 0) >=
                PRICE_RESYNC_INTERVAL_MS
        ) {
            kinds.push('prices')
        }
        return kinds
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

        const accountPass = await syncAccountsPhase(
            addresses,
            network,
            'refresh-accounts',
        )
        await syncTransactionsPhase(addresses, network, 'refresh-transactions')

        // New holdings land here with no metadata or price, so the asset row
        // renders a skeleton. Enrich immediately rather than waiting for the
        // coarse tick, which by then sees the holding already persisted
        // (holdingsChanged === false) and won't fetch until the interval elapses.
        const { hasHoldingsChanged } = accountPass
        if (hasHoldingsChanged) {
            // Self-contained so a read failure here can't skip the invalidations
            // below. refreshAccounts logs but never throws.
            try {
                const assetPass = await syncAssetsPhase(
                    network,
                    ['assets', 'prices'],
                    'refresh-asset-metadata-or-prices',
                )
                if (assetPass.hasSuccess) {
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

        // A holdings change ripples beyond the refreshed addresses (any
        // mounted account read joins in the just-fetched asset metadata and
        // prices), so match the tick's broad accounts pass in that case.
        // Otherwise scope to the refreshed addresses — including the
        // multi-account wealth chart, which must reflect the send immediately.
        if (hasHoldingsChanged) {
            invalidateAccountQueries(this.deps.queryClient)
        } else {
            invalidateAccountQueriesForAddresses(
                this.deps.queryClient,
                addresses,
                { includeMultiAccountKeys: true },
            )
        }
        invalidateTransactionQueriesForAddresses(
            this.deps.queryClient,
            addresses,
        )
    }
}
