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
import {
    accountsChainAdapters,
    invalidateAccountQueries,
    invalidateAccountQueriesForAddresses,
} from '@perawallet/wallet-core-accounts'
import {
    assetsChainAdapters,
    invalidateAssetQueries,
} from '@perawallet/wallet-core-assets'
import {
    hasCachedHistoryRows,
    invalidateSpendableBalanceQueries,
    invalidateTransactionQueries,
    invalidateTransactionQueriesForAddresses,
    invalidateTransactionQueriesForChain,
    invalidateTransactionQueriesForScope,
} from '@perawallet/wallet-core-transactions'
import {
    logger,
    calculateBackoff,
    isPeraNetworkError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    toScopeKey,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    broadcasterChainAdapters,
    reconcileOpenSubmissions,
    subscribeToSubmissionLedger,
} from '@perawallet/wallet-core-signing'
import type { AssetSyncKind } from '../polling'
import type { SyncServiceDeps } from '../models'
import { groupAddressesByScope, type ScopeAddresses } from './scope-groups'
import {
    isRateLimitError,
    resolveCheckpointRound,
    syncAccountsPhase,
    syncAssetsPhase,
    syncTransactionsPhase,
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

type ScopeSyncOutcome = {
    hadTotalFailure: boolean
    hadAccountFailure: boolean
    isRateLimited: boolean
}

const CLEAN_OUTCOME: ScopeSyncOutcome = {
    hadTotalFailure: false,
    hadAccountFailure: false,
    isRateLimited: false,
}

/** `intervalMs` is a duration; `nextEligibleAt` is epoch ms from `Date.now()`. */
type ScopeBackoff = { intervalMs: number; nextEligibleAt: number }

const isFailedOutcome = (outcome: ScopeSyncOutcome): boolean =>
    outcome.hadTotalFailure ||
    outcome.hadAccountFailure ||
    outcome.isRateLimited

type ChangeDecision = { changed: boolean; cursor: Nullable<number> }

const isRefusedCredential = (error: unknown): boolean =>
    isPeraNetworkError(error) && (error.status === 401 || error.status === 403)

export class SyncService {
    private timer: Nullable<ReturnType<typeof setTimeout>> = null
    private running = false
    // A scope's first sync of the session skips its change signal: the
    // persisted cursor may predate a relaunch, and the DB must be populated.
    private forceSyncedScopes = new Set<ChainScopeKey>()
    // A scope whose change signal got a 401/403: the key is wrong/missing, a
    // config-level problem retrying every tick can't fix. Reset on
    // start()/restart() so a rebuilt or reconfigured session recovers.
    private authRefusedScopes = new Set<ChainScopeKey>()
    // Pacing for a scope that failed its last pass, so one unhealthy endpoint
    // costs only its own scope. Cleared on restart() and on reconnect, and an
    // entry goes once its scope stops syncing (chain off, network switched).
    private scopeBackoffs = new Map<ChainScopeKey, ScopeBackoff>()
    private currentInterval: number
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
    private ledgerUnsubscribe: Nullable<() => void> = null
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
        // The spendable balance reads the ledger's open attempts, so a
        // broadcast must drop MAX and a settle bring it back. Debounced, since
        // a reconcile pass settles its rows in parallel.
        this.ledgerUnsubscribe ??= subscribeToSubmissionLedger(() =>
            this.debouncedInvalidate('spendable-balance', () =>
                invalidateSpendableBalanceQueries(this.deps.queryClient),
            ),
        )
        this.authRefusedScopes.clear()
        void this.tick()
    }

    stop(): void {
        this.running = false
        if (this.onlineUnsubscribe !== null) {
            this.onlineUnsubscribe()
            this.onlineUnsubscribe = null
        }
        if (this.ledgerUnsubscribe !== null) {
            this.ledgerUnsubscribe()
            this.ledgerUnsubscribe = null
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
        this.scopeBackoffs.clear()
        void this.tick()
    }

    restart(): void {
        this.stop()
        this.forceSyncedScopes.clear()
        this.scopeBackoffs.clear()
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
        // change signal, no reads. The loop stays cheaply scheduled so
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
            await this.reconcileSubmissions()

            const { chains, stores } = this.deps
            const groups = groupAddressesByScope(
                stores.getAccountChainAddresses(),
                stores.getSelectedScope,
            ).filter(
                ({ scope }) =>
                    !chains.isSwitchedOff(scope.chainId) &&
                    accountsChainAdapters.has(scope.chainId),
            )

            const groupKeys = new Set(
                groups.map(({ scope }) => toScopeKey(scope)),
            )
            for (const key of this.scopeBackoffs.keys()) {
                if (!groupKeys.has(key)) this.scopeBackoffs.delete(key)
            }

            // Concurrent, so one scope's timeout doesn't delay another's reads
            // within this tick.
            const nowMs = Date.now()
            const due = groups.filter(({ scope }) =>
                this.isScopeDue(toScopeKey(scope), nowMs),
            )
            const results = await Promise.allSettled(
                due.map(group => this.syncScope(group)),
            )
            let failedCount = 0
            results.forEach((result, index) => {
                if (this.recordScopeResult(due[index].scope, result, nowMs)) {
                    failedCount++
                }
            })

            // The loop backs off only when every scope that ran failed; a
            // scope that failed alone is paced by its own backoff. A tick that
            // finds every scope still waiting ran nothing, so it leaves the
            // interval as it is (a timer firing slightly early must not
            // reset the loop mid-outage).
            const isEveryScopeWaiting = groups.length > 0 && due.length === 0
            if (!isEveryScopeWaiting) {
                this.currentInterval =
                    due.length > 0 && failedCount === due.length
                        ? calculateBackoff(
                              this.currentInterval,
                              BACKOFF_MULTIPLIER,
                              MAX_BACKOFF_INTERVAL,
                          )
                        : this.baseInterval
            }
        } catch (error) {
            logger.warn('Sync tick failed', { error })
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

    private isScopeDue(key: ChainScopeKey, nowMs: number): boolean {
        const backoff = this.scopeBackoffs.get(key)
        if (backoff === undefined) return true
        // A wait longer than the interval itself means the device clock moved
        // back; without this the scope would stall for the whole skew.
        if (backoff.nextEligibleAt - nowMs > backoff.intervalMs) return true
        return backoff.nextEligibleAt <= nowMs
    }

    /**
     * Returns true when the scope failed. `tickStartedAtMs` anchors the wait:
     * the loop timer is armed only after the tick settles, so the tick's own
     * duration absorbs a timer firing a few ms early when the intervals match.
     */
    private recordScopeResult(
        scope: ChainScope,
        result: PromiseSettledResult<ScopeSyncOutcome>,
        tickStartedAtMs: number,
    ): boolean {
        const key = toScopeKey(scope)
        let isFailed: boolean
        if (result.status === 'rejected') {
            isFailed = true
            if (isRateLimitError(result.reason)) {
                logger.warn('Sync scope rate limited', { scope })
            } else {
                logger.warn('Sync scope failed', {
                    scope,
                    error: result.reason,
                })
            }
        } else {
            if (result.value.isRateLimited) {
                logger.warn('Sync scope rate limited', { scope })
            }
            isFailed = isFailedOutcome(result.value)
        }

        if (!isFailed) {
            this.scopeBackoffs.delete(key)
            return false
        }
        const intervalMs = calculateBackoff(
            this.scopeBackoffs.get(key)?.intervalMs ?? this.baseInterval,
            BACKOFF_MULTIPLIER,
            MAX_BACKOFF_INTERVAL,
        )
        this.scopeBackoffs.set(key, {
            intervalMs,
            nextEligibleAt: tickStartedAtMs + intervalMs,
        })
        return true
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
     * Settles open submission-attempt rows of every chain that is on and
     * broadcasts. Per chain rather than per account group, so rows still
     * settle once no account is left on the chain. Bounded, a no-op when
     * nothing is open, and never throws.
     */
    private async reconcileSubmissions(): Promise<void> {
        for (const { id } of this.deps.chains.list()) {
            if (this.deps.chains.isSwitchedOff(id)) continue
            if (!broadcasterChainAdapters.has(id)) continue
            const summary = await reconcileOpenSubmissions(id)
            if (summary.confirmed + summary.failed > 0) {
                // A settled row changes the pending history row's status, and
                // history queries are DB-cached with staleTime: Infinity, so a
                // settle on a no-work tick would otherwise leave a stale row.
                // Only the settled chain's: another chain's backend-read
                // History would refetch for nothing.
                invalidateTransactionQueriesForChain(this.deps.queryClient, id)
            }
        }
    }

    private async syncScope(group: ScopeAddresses): Promise<ScopeSyncOutcome> {
        const { scope, addresses } = group
        const key = toScopeKey(scope)

        if (!this.forceSyncedScopes.has(key)) {
            this.forceSyncedScopes.add(key)
            return this.syncScopeState(scope, addresses, null)
        }

        const cursor = this.deps.stores.getChangeCursor(scope)
        const signal = await this.readChangeSignal(scope, addresses, cursor)
        if (!signal.changed) {
            // Forward only: a signal source behind the reads' node would
            // otherwise rewind the cursor and re-sync what was already read.
            if (
                typeof signal.cursor === 'number' &&
                Number.isFinite(signal.cursor) &&
                (cursor === null || signal.cursor > cursor)
            ) {
                this.deps.stores.setChangeCursor(scope, signal.cursor)
            }
            return CLEAN_OUTCOME
        }
        return this.syncScopeState(scope, addresses, signal.cursor ?? null)
    }

    /**
     * Whether `scope` has anything to read. Deliberately does NOT advance the
     * cursor on a change — that happens in syncScopeState (see
     * resolveCheckpointRound) only after the pass actually observed the new
     * state. Advancing up front loses updates: if the data source still lags
     * the signal's source when we read it, every subsequent tick asks
     * "anything since R?" and is told no, so the stale balances stick until
     * unrelated on-chain activity.
     */
    private async readChangeSignal(
        scope: ChainScope,
        addresses: string[],
        cursor: Nullable<number>,
    ): Promise<ChangeDecision> {
        const adapter = accountsChainAdapters.get(scope.chainId)
        if (!adapter.fetchChangeSignal) {
            return { changed: true, cursor: null }
        }

        const key = toScopeKey(scope)
        // This backs off the signal REQUEST only: the account reads use other
        // credentials, so a never-synced scope still needs its force-sync.
        if (this.authRefusedScopes.has(key)) {
            return { changed: cursor === null, cursor: null }
        }

        try {
            return await adapter.fetchChangeSignal(addresses, scope, cursor)
        } catch (error) {
            const isRefused = isRefusedCredential(error)
            if (isRefused) {
                this.authRefusedScopes.add(key)
                logger.warn(
                    'Change signal refused (401/403); not asked again until restart',
                    {
                        scope,
                        status: isPeraNetworkError(error)
                            ? error.status
                            : undefined,
                    },
                )
            }
            // A never-synced scope must sync regardless of the refusal — see
            // the authRefusedScopes guard above.
            if (cursor === null) return { changed: true, cursor: null }
            if (isRefused) return { changed: false, cursor: null }
            // Rethrown so the scope backs off — swallowing here kept a
            // persistently failing signal retrying at the base interval.
            throw error
        }
    }

    // Phase order matters: the cursor advances off the account pass, and the
    // asset gate reads that pass's holdings change.
    private async syncScopeState(
        scope: ChainScope,
        addresses: string[],
        fallbackCursor: Nullable<number>,
    ): Promise<ScopeSyncOutcome> {
        let isRateLimited = false
        // Tracked across all phases because allSettled absorbs non-429 failures,
        // so a pass can make zero progress without ever throwing.
        let hadAnySuccess = false
        let hadAnyFailure = false
        const recordOutcome = (phase: SyncPhaseResult<unknown>) => {
            if (phase.hasSuccess) hadAnySuccess = true
            if (phase.hasFailure) hadAnyFailure = true
            if (phase.isRateLimited) isRateLimited = true
        }

        const accountPass = await syncAccountsPhase(addresses, scope, 'account')
        recordOutcome(accountPass)

        const round = resolveCheckpointRound(
            accountPass.results,
            fallbackCursor,
        )
        if (round !== null) {
            this.deps.stores.setChangeCursor(scope, round)
        }

        // Invalidation forces a wide DB re-read per account, so skip the
        // unchanged ones — which is the common tick.
        const { changedAddresses } = accountPass
        // Keyed per scope: the debounce keeps only the latest run per key, so
        // a shared key would drop the earlier scope's addresses.
        if (changedAddresses.length > 0) {
            this.debouncedInvalidate(`accounts:${toScopeKey(scope)}`, () =>
                invalidateAccountQueriesForAddresses(
                    this.deps.queryClient,
                    changedAddresses,
                ),
            )
        }

        const nowMs = Date.now()
        const dueKinds = this.dueAssetKinds(
            scope,
            nowMs,
            accountPass.hasHoldingsChanged,
        )
        if (dueKinds.length > 0) {
            const assetPass = await syncAssetsPhase(
                scope,
                dueKinds,
                'asset-metadata-or-prices',
            )
            recordOutcome(assetPass)
            // Only on success, so a failed pass retries next tick instead of
            // waiting out the interval.
            for (const kind of assetPass.succeededKinds) {
                this.deps.stores.setLastSyncAt(scope, kind, nowMs)
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
            scope,
            'transactions',
        )
        recordOutcome(txPass)
        // Per scope, like the accounts key above.
        const transactionsKey = `transactions:${toScopeKey(scope)}`
        if (!hasCachedHistoryRows(scope.chainId)) {
            // No cached rows, so History reads the backend: refetch it only
            // for the accounts whose state changed, not on every pass.
            if (changedAddresses.length > 0) {
                this.debouncedInvalidate(transactionsKey, () =>
                    invalidateTransactionQueriesForAddresses(
                        this.deps.queryClient,
                        changedAddresses,
                        scope,
                    ),
                )
            }
        } else if (txPass.hasSuccess) {
            // Skipped when every fetch was rejected — invalidation forces a DB
            // re-read with no new data to surface.
            this.debouncedInvalidate(transactionsKey, () =>
                invalidateTransactionQueriesForScope(
                    this.deps.queryClient,
                    scope,
                ),
            )
        }

        return {
            hadTotalFailure: hadAnyFailure && !hadAnySuccess,
            // Rejections freeze the cursor (see resolveCheckpointRound), so
            // the caller must back off or it re-syncs the scope every tick.
            hadAccountFailure: accountPass.hasFailure,
            isRateLimited,
        }
    }

    // The whole-portfolio asset reads are expensive, so each kind runs on a
    // holdings change or once its coarse interval has elapsed, not every tick.
    // The timestamps are persisted per scope, so a relaunch or a network
    // switch back resumes the interval rather than re-pricing straight away.
    private dueAssetKinds(
        scope: ChainScope,
        nowMs: number,
        hasHoldingsChanged: boolean,
    ): AssetSyncKind[] {
        const isDue = (kind: AssetSyncKind, intervalMs: number): boolean => {
            if (hasHoldingsChanged) return true
            const elapsedMs =
                nowMs - (this.deps.stores.getLastSyncAt(scope, kind) ?? 0)
            // Negative when the device clock moved back past a persisted
            // timestamp; without this the pass stalls until the clock catches up.
            return elapsedMs < 0 || elapsedMs >= intervalMs
        }
        const kinds: AssetSyncKind[] = []
        if (isDue('assets', ASSET_RESYNC_INTERVAL_MS)) kinds.push('assets')
        if (
            assetsChainAdapters.has(scope.chainId) &&
            isDue('prices', PRICE_RESYNC_INTERVAL_MS)
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
        scope: ChainScope,
    ): Promise<void> {
        if (addresses.length === 0) return

        const accountPass = await syncAccountsPhase(
            addresses,
            scope,
            'refresh-accounts',
        )
        await syncTransactionsPhase(addresses, scope, 'refresh-transactions')

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
                    scope,
                    ['assets', 'prices'],
                    'refresh-asset-metadata-or-prices',
                )
                if (assetPass.hasSuccess) {
                    invalidateAssetQueries(this.deps.queryClient)
                }
            } catch (error) {
                logger.warn('Refresh asset enrichment failed', {
                    scope,
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
            scope,
            { shouldRefetchAllPages: true },
        )
    }
}
