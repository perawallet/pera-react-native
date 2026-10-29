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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SyncService } from '../service/sync-service'
import { createSyncStorePorts } from '../service/store-ports'
import type { SyncServiceDeps } from '../models'
import { QueryClient, onlineManager } from '@tanstack/react-query'

// Drain queued microtasks (the async tick body chains several awaits with no
// intervening timers). Used with fake timers to fully resolve a tick before
// asserting on scheduling. Fake timers do not fake promises/microtasks, so a
// Promise.resolve() loop still advances them.
const flushMicrotasks = async (turns = 50): Promise<void> => {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve()
    }
}

const mockAccounts: {
    id: string
    name: string
    custody: { kind: 'watch' }
    chains: Record<string, { address: string }>
}[] = [
    {
        id: '1',
        name: 'Account 1',
        custody: { kind: 'watch' as const },
        chains: { algorand: { address: 'ADDR1' } },
    },
    {
        id: '2',
        name: 'Account 2',
        custody: { kind: 'watch' as const },
        chains: { algorand: { address: 'ADDR2' } },
    },
]

// Mirrors the private constants in sync-service.ts.
const POLL_INTERVAL = 3000
const MAX_BACKOFF_INTERVAL = 30_000

// The Pera should-refresh backend behind the Algorand change signal.
const mockSendShouldRefreshRequest = vi.fn()
const mockSetRefreshRound = vi.fn()
// Stateful so the asset/price cadence behaves as it would against the real
// store: a pass marked synced stays not-due until its interval elapses.
let mockSyncedAt: Record<string, { assets?: number; prices?: number }> = {}
const mockMarkSynced = vi.fn(
    (
        scope: { chainId: string; networkId: string },
        kind: 'assets' | 'prices',
        atMs: number,
    ) => {
        const key = `${scope.chainId}/${scope.networkId}`
        mockSyncedAt[key] = { ...mockSyncedAt[key], [kind]: atMs }
    },
)

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const

const isPeraBacked = (network: string) =>
    network === 'mainnet' || network === 'testnet'

type FixtureAdapter = {
    chainId: string
    fetchChangeSignal?: (
        addresses: string[],
        scope: { chainId: string; networkId: string },
        cursor: number | null,
    ) => Promise<{ changed: boolean; cursor: number }>
    maxConcurrentStateReads?: number
}

// Mirrors the Algorand adapter's change signal over the should-refresh mock.
const algorandAdapter: FixtureAdapter = {
    chainId: 'algorand',
    fetchChangeSignal: async (addresses, scope, cursor) => {
        if (!isPeraBacked(scope.networkId)) {
            return { changed: true, cursor: cursor ?? 0 }
        }
        const response = await mockSendShouldRefreshRequest(
            scope.networkId,
            addresses,
            cursor,
        )
        return {
            changed: cursor === null || response.refresh,
            cursor: response.round,
        }
    },
    maxConcurrentStateReads: 6,
}

let mockAdapters: Record<string, FixtureAdapter> = {}
// Chains with an assets adapter; read separately from the accounts adapters.
const mockAssetsChains = new Set<string>()
let mockSwitchedOff = new Set<string>()
const mockIsSwitchedOff = vi.fn((chainId: string) =>
    mockSwitchedOff.has(chainId),
)
let mockChainList: { id: string }[] = []
const mockBroadcasters = new Set<string>()
let mockConcurrencyLimits: { items: unknown[]; limit: number }[] = []

// Built per test so a test can swap the registry it reads.
const chainsDep = () =>
    ({
        isSwitchedOff: mockIsSwitchedOff,
        list: () => mockChainList,
    }) as unknown as SyncServiceDeps['chains']

const peraNetworkError = (status: number) =>
    Object.assign(new Error(`HTTP ${status}`), {
        name: 'PeraNetworkError',
        status,
    })

function cursorState(rounds: Record<string, number | null>) {
    const keys = new Set([...Object.keys(rounds), ...Object.keys(mockSyncedAt)])
    return {
        cursors: Object.fromEntries(
            [...keys].map(key => [
                key,
                {
                    refreshRound: rounds[key] ?? null,
                    lastAssetSyncAt: mockSyncedAt[key]?.assets ?? null,
                    lastPriceSyncAt: mockSyncedAt[key]?.prices ?? null,
                },
            ]),
        ),
        setRefreshRound: mockSetRefreshRound,
        markSynced: mockMarkSynced,
    }
}
const mockReconcileOpenSubmissions = vi.fn()
const mockLedgerListeners = new Set<() => void>()

vi.mock('@perawallet/wallet-core-signing', () => ({
    broadcasterChainAdapters: {
        has: (chainId: string) => mockBroadcasters.has(chainId),
    },
    reconcileOpenSubmissions: (...args: unknown[]) =>
        mockReconcileOpenSubmissions(...args),
    subscribeToSubmissionLedger: (listener: () => void) => {
        mockLedgerListeners.add(listener)
        return () => {
            mockLedgerListeners.delete(listener)
        }
    },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    accountsChainAdapters: {
        get: (chainId: string) => mockAdapters[chainId],
        has: (chainId: string) => chainId in mockAdapters,
    },
    useAccountsStore: {
        getState: () => ({ accounts: mockAccounts }),
    },
    refreshAccountHoldings: vi.fn(() => Promise.resolve(true)),
    getAllHeldAssetIdsForNetwork: vi.fn(() => Promise.resolve(['123', '456'])),
    invalidateAccountQueries: vi.fn(),
    invalidateAccountQueriesForAddresses: vi.fn(),
    fetchAndPersistAccount: vi.fn(() =>
        Promise.resolve({ changed: true, holdingsChanged: true }),
    ),
}))

// Mutable so a test can switch Algorand's selected network to 'custom' without
// re-mocking the whole module — reset in beforeEach to avoid cross-test leakage.
let mockNetwork = 'mainnet'

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getSelectedScope: (chainId: string) => ({
        chainId,
        networkId: chainId === 'algorand' ? mockNetwork : 'mainnet',
    }),
}))

vi.mock('../polling', () => ({
    useSyncCursorStore: {
        getState: () =>
            cursorState({
                'algorand/mainnet': null,
                'algorand/testnet': null,
            }),
    },
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchAssets: vi.fn(() =>
        Promise.resolve({ results: [], next: null, previous: null }),
    ),
    fetchAssetPrices: vi.fn(() =>
        Promise.resolve({ results: [], next: null, previous: null }),
    ),
    fetchPublicAssetDetails: vi.fn(() => Promise.resolve({ usd_value: '1.0' })),
    transformAssetResponse: vi.fn(x => x),
    upsertAssets: vi.fn(() => Promise.resolve()),
    upsertAssetPrices: vi.fn(() => Promise.resolve()),
    assetsChainAdapters: {
        has: (chainId: string) => mockAssetsChains.has(chainId),
    },
    invalidateAssetQueries: vi.fn(),
    fetchAndPersistAssets: vi.fn(() => Promise.resolve()),
    fetchAndPersistPrices: vi.fn(() => Promise.resolve()),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    hasCachedHistoryRows: vi.fn(() => true),
    fetchTransactionHistory: vi.fn(() =>
        Promise.resolve({
            transactions: [],
            pagination: { nextUrl: null },
            currentRound: 0,
        }),
    ),
    getLatestTransactionRoundTime: vi.fn(() => Promise.resolve(null)),
    upsertTransactions: vi.fn(() => Promise.resolve()),
    invalidateSpendableBalanceQueries: vi.fn(),
    invalidateTransactionQueries: vi.fn(),
    invalidateTransactionQueriesForAddresses: vi.fn(),
    invalidateTransactionQueriesForChain: vi.fn(),
    invalidateTransactionQueriesForScope: vi.fn(),
    fetchAndPersistTransactions: vi.fn(() => Promise.resolve()),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actualShared =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        logger: {
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
        },
        isPeraNetworkError: (error: unknown) =>
            error instanceof Error && error.name === 'PeraNetworkError',
        getHttpStatus: actualShared.getHttpStatus,
        partition: (arr: unknown[], size: number) => {
            const result = []
            for (let i = 0; i < arr.length; i += size) {
                result.push((arr as unknown[]).slice(i, i + size))
            }
            return result
        },
        calculateBackoff: (current: number, multiplier: number, max: number) =>
            Math.min(current * multiplier, max),
        // Unbounded stand-in: these tests assert what gets fetched and how failures
        // are handled, not the concurrency cap. The real limiting behaviour is
        // covered in shared's async tests — do not read a passing suite here as
        // evidence that the cap works.
        mapWithConcurrency: async <T, R>(
            items: T[],
            limit: number,
            mapper: (item: T, index: number) => Promise<R>,
        ) => {
            mockConcurrencyLimits.push({ items, limit })
            return Promise.allSettled(
                items.map((item, index) => mapper(item, index)),
            )
        },
    }
})

describe('SyncService', () => {
    let queryClient: QueryClient
    let service: SyncService

    beforeEach(async () => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        mockNetwork = 'mainnet'
        mockSwitchedOff = new Set()
        mockSyncedAt = {}
        mockAdapters = { algorand: algorandAdapter }
        mockChainList = [{ id: 'algorand' }]
        mockBroadcasters.clear()
        mockBroadcasters.add('algorand')
        mockAssetsChains.clear()
        mockAssetsChains.add('algorand')
        mockConcurrencyLimits = []
        mockAccounts.splice(2)
        queryClient = new QueryClient()
        // The store-backed ports over the mocked stores, so the tests below
        // also cover createSyncStorePorts' absent-key semantics.
        service = new SyncService({
            queryClient,
            stores: createSyncStorePorts(),
            chains: chainsDep(),
        })

        // Re-establish default success implementations. clearAllMocks() clears
        // call history but not implementations set by individual tests, so reset
        // them here to keep the change-gated sync behavior consistent.
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')
        const { fetchAndPersistAssets, fetchAndPersistPrices } =
            await import('@perawallet/wallet-core-assets')
        const { fetchAndPersistTransactions, hasCachedHistoryRows } =
            await import('@perawallet/wallet-core-transactions')
        vi.mocked(hasCachedHistoryRows).mockImplementation(() => true)
        vi.mocked(fetchAndPersistAccount).mockImplementation(() =>
            Promise.resolve({ changed: true, holdingsChanged: true }),
        )
        vi.mocked(fetchAndPersistAssets).mockImplementation(() =>
            Promise.resolve(),
        )
        vi.mocked(fetchAndPersistPrices).mockImplementation(() =>
            Promise.resolve(),
        )
        vi.mocked(fetchAndPersistTransactions).mockImplementation(() =>
            Promise.resolve(),
        )
        // Every tick calls the reconciler; a real summary keeps the badge
        // invalidation branch deterministic regardless of test order.
        mockReconcileOpenSubmissions.mockResolvedValue({
            probed: 0,
            confirmed: 0,
            failed: 0,
        })
    })

    afterEach(async () => {
        service.stop()
        // stop() leaves an in-flight tick running. Drained under fake timers,
        // its continuation can't outlive the test and call the shared mocks
        // inside a later one.
        await vi.runAllTimersAsync()
        vi.useRealTimers()
    })

    it('starts and stops correctly', () => {
        expect(service.isRunning()).toBe(false)

        service.start()
        expect(service.isRunning()).toBe(true)

        service.stop()
        expect(service.isRunning()).toBe(false)
    })

    it('does not start twice', () => {
        service.start()
        service.start() // should be a no-op
        expect(service.isRunning()).toBe(true)

        service.stop()
        expect(service.isRunning()).toBe(false)
    })

    describe('submission ledger', () => {
        const ledgerChanged = () => {
            for (const listener of mockLedgerListeners) listener()
        }

        it('re-prices the spendable balance once for a burst of ledger writes', async () => {
            const { invalidateSpendableBalanceQueries } =
                await import('@perawallet/wallet-core-transactions')
            service.start()

            ledgerChanged()
            ledgerChanged()
            ledgerChanged()
            expect(invalidateSpendableBalanceQueries).not.toHaveBeenCalled()
            await vi.advanceTimersByTimeAsync(250)

            expect(invalidateSpendableBalanceQueries).toHaveBeenCalledTimes(1)
            expect(invalidateSpendableBalanceQueries).toHaveBeenCalledWith(
                queryClient,
            )
        })

        it('subscribes once while running and not after stop', () => {
            service.start()
            service.start()
            expect(mockLedgerListeners.size).toBe(1)

            service.stop()

            expect(mockLedgerListeners.size).toBe(0)
        })
    })

    it('reconciles open submission attempts on each online tick', async () => {
        mockReconcileOpenSubmissions.mockResolvedValue({
            probed: 1,
            confirmed: 1,
            failed: 0,
        })

        service.start()
        await flushMicrotasks()

        expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(1)

        // The next scheduled tick reconciles again.
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
        await flushMicrotasks()
        expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(2)

        service.stop()
    })

    it('skips reconciliation while offline (shares the online gate)', async () => {
        const wasOnline = onlineManager.isOnline()
        onlineManager.setOnline(false)

        service.start()
        await flushMicrotasks()

        expect(mockReconcileOpenSubmissions).not.toHaveBeenCalled()

        service.stop()
        onlineManager.setOnline(wasOnline)
    })

    it('reconciles immediately on reconnect', async () => {
        const wasOnline = onlineManager.isOnline()
        onlineManager.setOnline(false)

        service.start()
        await flushMicrotasks()
        expect(mockReconcileOpenSubmissions).not.toHaveBeenCalled()

        // Offline → online fires the subscription → an immediate tick that
        // reconciles without waiting out the poll interval.
        onlineManager.setOnline(true)
        await flushMicrotasks()

        expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(1)

        service.stop()
        onlineManager.setOnline(wasOnline)
    })

    it('does not start a second tick while a reconcile pass is in flight', async () => {
        const wasOnline = onlineManager.isOnline()
        let releaseReconcile = (): void => {}
        const inFlight = new Promise<void>(resolve => {
            releaseReconcile = resolve
        })
        mockReconcileOpenSubmissions.mockImplementationOnce(async () => {
            await inFlight
            return { probed: 0, confirmed: 0, failed: 0 }
        })

        service.start()
        await flushMicrotasks()
        expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(1)

        // A reconnect arriving mid-pass must find the tick already marked in
        // progress — otherwise two passes probe the same rows and two syncAll
        // runs overlap.
        onlineManager.setOnline(false)
        onlineManager.setOnline(true)
        await flushMicrotasks()
        expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(1)

        releaseReconcile()
        await flushMicrotasks()

        service.stop()
        onlineManager.setOnline(wasOnline)
    })

    // The tick persists to SQLite before its debounced invalidation fires. If
    // stop() (app background, network switch) dropped the pending timer, the
    // notification would be lost for good: the next tick diffs against the
    // already-persisted state, sees "unchanged", and never re-invalidates —
    // mounted staleTime-Infinity queries stay stale until app restart.
    it('flushes pending debounced invalidations on stop instead of dropping them', async () => {
        const { invalidateAccountQueriesForAddresses } =
            await import('@perawallet/wallet-core-accounts')

        service.start()

        // Let the first (force-sync) tick run to completion; its account
        // invalidation is now sitting behind the debounce timer.
        await vi.advanceTimersByTimeAsync(50)

        expect(invalidateAccountQueriesForAddresses).not.toHaveBeenCalled()

        service.stop()

        expect(invalidateAccountQueriesForAddresses).toHaveBeenCalledWith(
            queryClient,
            mockAccounts.map(a => a.chains.algorand.address),
        )
    })

    // A tick persists to SQLite per account, on the same JS thread a scroll is
    // being rendered on. Pausing trades a moment of staleness for a gesture that
    // does not hitch.
    it('holds off syncing while paused', async () => {
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        service.pause()

        service.start()
        await vi.advanceTimersByTimeAsync(100)

        expect(fetchAndPersistAccount).not.toHaveBeenCalled()

        service.stop()
    })

    it('syncs again once resumed', async () => {
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        service.pause()
        service.start()
        await vi.advanceTimersByTimeAsync(50)
        expect(fetchAndPersistAccount).not.toHaveBeenCalled()

        service.resume()
        // Past PAUSE_RECHECK_MS so the deferred re-check runs.
        await vi.advanceTimersByTimeAsync(600)

        expect(fetchAndPersistAccount).toHaveBeenCalled()

        service.stop()
    })

    // Several long lists can be mounted at once (the account tabs all stay
    // mounted), so one list's resume must not cancel another's pause.
    it('ref-counts pauses so one resume does not release another holder', () => {
        service.pause()
        service.pause()

        service.resume()
        expect(service.isPaused()).toBe(true)

        service.resume()
        expect(service.isPaused()).toBe(false)
    })

    it('ignores a resume with no matching pause rather than going negative', () => {
        service.resume()
        expect(service.isPaused()).toBe(false)

        service.pause()
        expect(service.isPaused()).toBe(true)
    })

    // The recovery path: a list unmounted mid-scroll never resumes, and without
    // the ceiling that would stop background sync for the rest of the process.
    it('force-clears an abandoned pause after the ceiling elapses', () => {
        service.pause()
        service.pause()
        expect(service.isPaused()).toBe(true)

        // MAX_PAUSE_MS is 5s.
        vi.advanceTimersByTime(5001)

        expect(service.isPaused()).toBe(false)
    })

    it('re-arms the ceiling on each pause instead of inheriting a spent one', () => {
        service.pause()
        vi.advanceTimersByTime(4000)
        service.pause()
        vi.advanceTimersByTime(4000)

        // 8s since the first pause, only 4s since the last — still held.
        expect(service.isPaused()).toBe(true)
    })

    it('drops any held pause on stop so it cannot bleed into the next start', () => {
        service.pause()
        expect(service.isPaused()).toBe(true)

        service.stop()

        expect(service.isPaused()).toBe(false)
    })

    it('force-syncs all networks on the first tick', async () => {
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        service.start()

        // First tick runs immediately — should NOT call shouldRefresh
        await vi.advanceTimersByTimeAsync(50)

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()

        service.stop()
    })

    it('does no network work for a switched-off chain, and force-syncs once it is back on', async () => {
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })
        mockSwitchedOff.add('algorand')

        service.start()
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL)

        expect(mockIsSwitchedOff).toHaveBeenCalledWith('algorand')
        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
        expect(mockReconcileOpenSubmissions).not.toHaveBeenCalled()
        expect(fetchAndPersistAccount).not.toHaveBeenCalled()

        mockSwitchedOff.delete('algorand')
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL)

        // The first tick that runs is still the unconditional force-sync.
        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
        expect(fetchAndPersistAccount).toHaveBeenCalled()

        service.stop()
    })

    it('calls shouldRefresh for the active network on subsequent ticks', async () => {
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        service.start()

        // First tick: force-sync (skip shouldRefresh)
        await vi.advanceTimersByTimeAsync(50)

        // Second tick: uses shouldRefresh (after POLL_INTERVAL = 3000ms)
        await vi.advanceTimersByTimeAsync(3100)

        service.stop()

        expect(mockSendShouldRefreshRequest).toHaveBeenCalledWith(
            'mainnet',
            ['ADDR1', 'ADDR2'],
            null,
        )
        expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)
    })

    it('updates last refreshed round when refresh is needed', async () => {
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: true,
            round: 42,
        })

        service.start()

        // First tick: force-sync (skip shouldRefresh)
        await vi.advanceTimersByTimeAsync(50)

        // Second tick: uses shouldRefresh
        await vi.advanceTimersByTimeAsync(3050)

        service.stop()

        expect(mockSetRefreshRound).toHaveBeenCalledWith(MAINNET, 42)
    })

    it('freezes the round when any account fetch fails', async () => {
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')

        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: true,
            round: 42,
        })
        // One account fails — advancing on the others' success would let the
        // checkpoint skip past the failed account's unfetched rounds, leaving
        // it stale until its next on-chain activity. The failed pass is
        // retried at backoff cadence instead (see failure-aware backoff).
        vi.mocked(fetchAndPersistAccount).mockImplementation(
            async (address: string) => {
                if (address === 'ADDR2') {
                    throw new Error('indexer hiccup')
                }
                return {
                    changed: true,
                    holdingsChanged: true,
                    observedRound: 42,
                }
            },
        )

        service.start()

        // First tick: force-sync (partial failure backs the loop off to 6 s);
        // second tick: shouldRefresh-gated sync.
        await vi.advanceTimersByTimeAsync(50)
        await vi.advanceTimersByTimeAsync(6200)

        service.stop()

        expect(mockSendShouldRefreshRequest).toHaveBeenCalled()
        expect(mockSetRefreshRound).not.toHaveBeenCalled()
    })

    it('does not advance the round when every account fetch fails', async () => {
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')

        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: true,
            round: 42,
        })
        vi.mocked(fetchAndPersistAccount).mockRejectedValue(
            new Error('indexer down'),
        )

        service.start()

        await vi.advanceTimersByTimeAsync(50)
        await vi.advanceTimersByTimeAsync(3100)

        service.stop()

        expect(mockSetRefreshRound).not.toHaveBeenCalled()
    })

    it('advances the round to the minimum the account fetches observed', async () => {
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')

        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: true,
            round: 105,
        })
        // ADDR2's data source trails the backend-reported round 105 — the
        // checkpoint must not move past what was actually read, so the next
        // tick re-asks and re-syncs until the source catches up.
        vi.mocked(fetchAndPersistAccount).mockImplementation(
            async (address: string) => ({
                changed: false,
                holdingsChanged: false,
                observedRound: address === 'ADDR1' ? 105 : 99,
            }),
        )

        service.start()

        await vi.advanceTimersByTimeAsync(50)
        mockSetRefreshRound.mockClear()
        await vi.advanceTimersByTimeAsync(3100)

        service.stop()

        expect(mockSetRefreshRound).toHaveBeenCalledWith(MAINNET, 99)
    })

    it('restart stops, resets initial sync flag, and starts immediately', async () => {
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')

        service.start()
        expect(service.isRunning()).toBe(true)

        // First tick: force-sync (no shouldRefresh)
        await vi.advanceTimersByTimeAsync(50)

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
        expect(fetchAndPersistAccount).toHaveBeenCalled()

        vi.mocked(fetchAndPersistAccount).mockClear()
        mockSendShouldRefreshRequest.mockClear()

        // Restart — should force-sync again (hasCompletedInitialSync reset)
        service.restart()
        expect(service.isRunning()).toBe(true)

        await vi.advanceTimersByTimeAsync(50)

        // Should have force-synced without calling shouldRefresh
        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
        expect(fetchAndPersistAccount).toHaveBeenCalled()

        service.stop()
    })

    it('restart when stopped starts the service', () => {
        expect(service.isRunning()).toBe(false)
        service.restart()
        expect(service.isRunning()).toBe(true)
        service.stop()
    })

    it('logs per-account sync errors instead of swallowing them', async () => {
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')
        const { logger } = await import('@perawallet/wallet-core-shared')

        vi.mocked(fetchAndPersistAccount).mockImplementation(
            async (address: string) => {
                if (address === 'ADDR2') {
                    throw new Error('algod network error')
                }
            },
        )

        service.start()
        await vi.advanceTimersByTimeAsync(50)

        expect(logger.warn).toHaveBeenCalledWith(
            'Sync step failed',
            expect.objectContaining({
                phase: 'account',
                scope: MAINNET,
                subject: 'ADDR2',
                error: expect.objectContaining({
                    message: 'algod network error',
                }),
            }),
        )

        vi.mocked(fetchAndPersistAccount).mockImplementation(() =>
            Promise.resolve(),
        )
        service.stop()
    })

    it('does not sync when no accounts exist', async () => {
        const originalGetState = vi.fn(() => ({ accounts: [] }))
        vi.mocked(
            await import('@perawallet/wallet-core-accounts'),
        ).useAccountsStore.getState = originalGetState

        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        service.start()
        await vi.advanceTimersByTimeAsync(0)

        // sendShouldRefreshRequest should not be called with empty addresses
        // Actually it returns early with refresh: false
        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()

        // Restore
        vi.mocked(
            await import('@perawallet/wallet-core-accounts'),
        ).useAccountsStore.getState = () =>
            ({ accounts: mockAccounts }) as ReturnType<
                typeof import('@perawallet/wallet-core-accounts').useAccountsStore.getState
            >
    })

    it('falls back to force-syncing the active network when shouldRefresh errors before first sync', async () => {
        mockSendShouldRefreshRequest.mockRejectedValue(
            new Error('network down'),
        )
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')
        const { useSyncCursorStore } = await import('../polling')

        // Pretend we already completed the initial force-sync so the next
        // tick goes through checkShouldRefresh. lastRefreshedRound must be
        // null so `neverSynced` is true when shouldRefresh throws.
        vi.mocked(useSyncCursorStore.getState).mockReturnValueOnce?.(
            cursorState({
                'algorand/mainnet': null,
                'algorand/testnet': null,
            }) as never,
        )

        service.start()
        await vi.advanceTimersByTimeAsync(50)
        await vi.advanceTimersByTimeAsync(3100)
        service.stop()

        // neverSynced + shouldRefresh throw => force-sync the active network
        expect(mockSendShouldRefreshRequest).toHaveBeenCalled()
        expect(fetchAndPersistAccount).toHaveBeenCalled()
    })

    it('backs off the change signal after a 401 and skips subsequent requests', async () => {
        const authError = peraNetworkError(401)
        mockSendShouldRefreshRequest.mockRejectedValue(authError)
        const { logger } = await import('@perawallet/wallet-core-shared')

        service.start()
        await vi.advanceTimersByTimeAsync(50) // 1st tick: force-sync
        await vi.advanceTimersByTimeAsync(3100) // 2nd tick: should-refresh -> 401

        expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('refused'),
            expect.objectContaining({ status: 401 }),
        )

        mockSendShouldRefreshRequest.mockClear()
        await vi.advanceTimersByTimeAsync(3100) // 3rd tick: guarded, no request

        service.stop()

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
    })

    it('keeps asking after an integrity refusal: it clears once the extension holds a token', async () => {
        mockSendShouldRefreshRequest.mockRejectedValue(
            Object.assign(new Error('[integrity] 401'), {
                name: 'IntegrityRequiredError',
                status: 401,
            }),
        )

        service.start()
        await vi.advanceTimersByTimeAsync(50) // 1st tick: force-sync
        await vi.advanceTimersByTimeAsync(3100) // 2nd tick: should-refresh -> refused
        mockSendShouldRefreshRequest.mockClear()
        await vi.advanceTimersByTimeAsync(60_000) // past the tick backoff

        service.stop()

        expect(mockSendShouldRefreshRequest).toHaveBeenCalled()
    })

    it('treats 403 the same as 401 for the auth backoff', async () => {
        const authError = peraNetworkError(403)
        mockSendShouldRefreshRequest.mockRejectedValue(authError)

        service.start()
        await vi.advanceTimersByTimeAsync(50)
        await vi.advanceTimersByTimeAsync(3100)

        mockSendShouldRefreshRequest.mockClear()
        await vi.advanceTimersByTimeAsync(3100)

        service.stop()

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
    })

    it('resets the auth-failure flag on restart so a reconfigured session recovers', async () => {
        const authError = peraNetworkError(401)
        mockSendShouldRefreshRequest.mockRejectedValue(authError)

        service.start()
        await vi.advanceTimersByTimeAsync(50)
        await vi.advanceTimersByTimeAsync(3100)

        expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)

        mockSendShouldRefreshRequest.mockClear()
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })
        service.restart()

        await vi.advanceTimersByTimeAsync(50) // restart force-syncs first
        await vi.advanceTimersByTimeAsync(3100) // then should-refresh resumes

        service.stop()

        expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)
    })

    it('still force-syncs a never-synced network through the auth backoff, on that tick and subsequent ticks', async () => {
        // lastRefreshedRound stays null throughout (default mock) so the
        // network is never-synced on every tick — algod/indexer use
        // separate credentials from the backend key, so a 401 there must
        // not block the force-sync fallback.
        const authError = peraNetworkError(401)
        mockSendShouldRefreshRequest.mockRejectedValue(authError)
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')

        service.start()
        await vi.advanceTimersByTimeAsync(50) // 1st tick: force-sync (initial)

        vi.mocked(fetchAndPersistAccount).mockClear()
        await vi.advanceTimersByTimeAsync(3100) // 2nd tick: should-refresh -> 401, but never-synced still force-syncs

        expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)
        expect(fetchAndPersistAccount).toHaveBeenCalled()

        mockSendShouldRefreshRequest.mockClear()
        vi.mocked(fetchAndPersistAccount).mockClear()
        await vi.advanceTimersByTimeAsync(3100) // 3rd tick: guarded (no request), never-synced force-sync still fires

        service.stop()

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
        expect(fetchAndPersistAccount).toHaveBeenCalled()
    })

    it('once synced, does not re-issue the should-refresh request or re-log the warning', async () => {
        const authError = peraNetworkError(401)
        mockSendShouldRefreshRequest.mockRejectedValue(authError)
        const { logger } = await import('@perawallet/wallet-core-shared')
        const { useSyncCursorStore } = await import('../polling')
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')

        service.start()
        await vi.advanceTimersByTimeAsync(50) // 1st tick: force-sync
        await vi.advanceTimersByTimeAsync(3100) // 2nd tick: should-refresh -> 401, flag set

        expect(logger.warn).toHaveBeenCalledTimes(1)

        // Simulate the network becoming synced (lastRefreshedRound no longer null).
        useSyncCursorStore.getState = vi.fn(() =>
            cursorState({
                'algorand/mainnet': 100,
                'algorand/testnet': null,
            }),
        )
        vi.mocked(logger.warn).mockClear()
        mockSendShouldRefreshRequest.mockClear()
        vi.mocked(fetchAndPersistAccount).mockClear()

        await vi.advanceTimersByTimeAsync(3100) // 3rd tick: now synced — guarded, no fallback

        service.stop()

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
        expect(fetchAndPersistAccount).not.toHaveBeenCalled()
    })

    it('force-syncs a network absent from the persisted round map, sending null (not undefined) for its last-refreshed round', async () => {
        const { useSyncCursorStore } = await import('../polling')
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')

        // Exercise the `?? null` semantics on a Pera-backed network (so this
        // tick still reaches sendShouldRefreshRequest — see the
        // "Pera-backed network gating" tests for the non-backed case, e.g.
        // betanet/custom, which now short-circuit before this request
        // entirely and so can no longer demonstrate the wire-payload
        // assertion below). testnet's key is absent here to simulate a
        // partially-seeded persisted map, mirroring how the polling
        // store can have a network key genuinely absent rather than an
        // explicit null.
        mockNetwork = 'testnet'
        useSyncCursorStore.getState = vi.fn(() =>
            cursorState({ 'algorand/mainnet': 100 }),
        )
        // Backend says "no work needed" — if the absent key were wrongly read
        // as already-synced (undefined !== null), this response alone would
        // skip the force-sync and reproduce the silent bug.
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        try {
            service.start()
            await vi.advanceTimersByTimeAsync(50) // 1st tick: unconditional force-sync
            vi.mocked(fetchAndPersistAccount).mockClear()
            mockSendShouldRefreshRequest.mockClear()

            await vi.advanceTimersByTimeAsync(3100) // 2nd tick: checkShouldRefresh path

            service.stop()

            // Site 1 (neverSynced): the absent key must still force-sync, even
            // though the backend reported refresh: false.
            expect(fetchAndPersistAccount).toHaveBeenCalled()
            // Site 2 (wire payload): the absent key must serialize as null,
            // not undefined, in the /v1/accounts/should-refresh/ POST body —
            // a different request payload, not just a type-checker nuance.
            expect(mockSendShouldRefreshRequest).toHaveBeenCalledWith(
                'testnet',
                ['ADDR1', 'ADDR2'],
                null,
            )
        } finally {
            // Restore the shared mocks to their module-level defaults so a
            // failed assertion above can't leak this test's per-test override
            // (a genuinely different network key from every other test in
            // this file) into whatever test runs next.
            mockNetwork = 'mainnet'
            useSyncCursorStore.getState = () =>
                cursorState({
                    'algorand/mainnet': null,
                    'algorand/testnet': null,
                })
        }
    })

    it('rate-limited failures trigger backoff on the next tick', async () => {
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')
        const { logger } = await import('@perawallet/wallet-core-shared')

        vi.mocked(fetchAndPersistAccount).mockRejectedValue(
            peraNetworkError(429),
        )

        service.start()
        await vi.advanceTimersByTimeAsync(50)
        // 429 is filtered from the per-account log; the scope reports it once.
        expect(logger.warn).toHaveBeenCalledWith('Sync scope rate limited', {
            scope: MAINNET,
        })
        vi.mocked(fetchAndPersistAccount).mockClear()

        // Backed off to 6 s: nothing at the base interval.
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
        expect(fetchAndPersistAccount).not.toHaveBeenCalled()
        service.stop()

        vi.mocked(fetchAndPersistAccount).mockImplementation(() =>
            Promise.resolve(),
        )
    })

    describe('refreshAccounts', () => {
        it('returns early when given an empty address list', async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            const { fetchAndPersistTransactions } =
                await import('@perawallet/wallet-core-transactions')

            await service.refreshAccounts([], MAINNET)

            expect(fetchAndPersistAccount).not.toHaveBeenCalled()
            expect(fetchAndPersistTransactions).not.toHaveBeenCalled()
        })

        it('fetches account info and transactions for each given address', async () => {
            const { fetchAndPersistAccount, invalidateAccountQueries } =
                await import('@perawallet/wallet-core-accounts')
            const {
                fetchAndPersistTransactions,
                invalidateTransactionQueriesForAddresses,
            } = await import('@perawallet/wallet-core-transactions')

            await service.refreshAccounts(['ADDR1', 'ADDR2'], TESTNET)

            expect(fetchAndPersistAccount).toHaveBeenCalledTimes(2)
            expect(fetchAndPersistAccount).toHaveBeenCalledWith('ADDR1', {
                chainId: 'algorand',
                networkId: 'testnet',
            })
            expect(fetchAndPersistAccount).toHaveBeenCalledWith('ADDR2', {
                chainId: 'algorand',
                networkId: 'testnet',
            })
            expect(fetchAndPersistTransactions).toHaveBeenCalledTimes(2)
            expect(fetchAndPersistTransactions).toHaveBeenCalledWith('ADDR1', {
                chainId: 'algorand',
                networkId: 'testnet',
            })
            expect(fetchAndPersistTransactions).toHaveBeenCalledWith('ADDR2', {
                chainId: 'algorand',
                networkId: 'testnet',
            })
            // Default mock reports holdingsChanged, so the accounts pass is
            // broad; transactions are always scoped to the given addresses.
            expect(invalidateAccountQueries).toHaveBeenCalledWith(queryClient)
            expect(
                invalidateTransactionQueriesForAddresses,
            ).toHaveBeenCalledWith(queryClient, ['ADDR1', 'ADDR2'], TESTNET, {
                shouldRefetchAllPages: true,
            })
        })

        it('scopes invalidation to the given addresses when no holdings changed', async () => {
            const {
                fetchAndPersistAccount,
                invalidateAccountQueries,
                invalidateAccountQueriesForAddresses,
            } = await import('@perawallet/wallet-core-accounts')
            const { invalidateTransactionQueriesForAddresses } =
                await import('@perawallet/wallet-core-transactions')

            vi.mocked(fetchAndPersistAccount).mockResolvedValue({
                changed: true,
                holdingsChanged: false,
                observedRound: null,
            })

            await service.refreshAccounts(['ADDR1'], MAINNET)

            expect(invalidateAccountQueries).not.toHaveBeenCalled()
            expect(invalidateAccountQueriesForAddresses).toHaveBeenCalledWith(
                queryClient,
                ['ADDR1'],
                { includeMultiAccountKeys: true },
            )
            expect(
                invalidateTransactionQueriesForAddresses,
            ).toHaveBeenCalledWith(queryClient, ['ADDR1'], MAINNET, {
                shouldRefetchAllPages: true,
            })

            vi.mocked(fetchAndPersistAccount).mockImplementation(() =>
                Promise.resolve({ changed: true, holdingsChanged: true }),
            )
        })

        it('logs and swallows individual fetch failures, never throwing', async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            const { logger } = await import('@perawallet/wallet-core-shared')

            vi.mocked(fetchAndPersistAccount).mockImplementationOnce(
                async () => {
                    throw new Error('boom')
                },
            )

            await expect(
                service.refreshAccounts(['ADDR1', 'ADDR2'], MAINNET),
            ).resolves.toBeUndefined()

            expect(logger.warn).toHaveBeenCalledWith(
                'Sync step failed',
                expect.objectContaining({
                    phase: 'refresh-accounts',
                    error: expect.objectContaining({ message: 'boom' }),
                }),
            )

            vi.mocked(fetchAndPersistAccount).mockImplementation(() =>
                Promise.resolve(),
            )
        })

        it('still invalidates queries when fetches fail', async () => {
            const {
                fetchAndPersistAccount,
                invalidateAccountQueriesForAddresses,
            } = await import('@perawallet/wallet-core-accounts')
            const { invalidateTransactionQueriesForAddresses } =
                await import('@perawallet/wallet-core-transactions')

            vi.mocked(fetchAndPersistAccount).mockRejectedValueOnce(
                new Error('all fetches fail'),
            )

            await service.refreshAccounts(['ADDR1'], MAINNET)

            // A rejected fetch reports no holdings change, so the scoped
            // (non-broad) path applies.
            expect(invalidateAccountQueriesForAddresses).toHaveBeenCalledWith(
                queryClient,
                ['ADDR1'],
                { includeMultiAccountKeys: true },
            )
            expect(
                invalidateTransactionQueriesForAddresses,
            ).toHaveBeenCalledWith(queryClient, ['ADDR1'], MAINNET, {
                shouldRefetchAllPages: true,
            })

            vi.mocked(fetchAndPersistAccount).mockImplementation(() =>
                Promise.resolve(),
            )
        })

        it('enriches asset metadata and prices when holdings changed (e.g. swap into a not-opted-in asset)', async () => {
            const { getAllHeldAssetIdsForNetwork } =
                await import('@perawallet/wallet-core-accounts')
            const {
                fetchAndPersistAssets,
                fetchAndPersistPrices,
                invalidateAssetQueries,
            } = await import('@perawallet/wallet-core-assets')

            // Default mock: fetchAndPersistAccount returns holdingsChanged: true.
            await service.refreshAccounts(['ADDR1'], MAINNET)

            expect(getAllHeldAssetIdsForNetwork).toHaveBeenCalledWith({
                scope: { chainId: 'algorand', networkId: 'mainnet' },
            })
            expect(fetchAndPersistAssets).toHaveBeenCalledWith(['123', '456'], {
                chainId: 'algorand',
                networkId: 'mainnet',
            })
            expect(fetchAndPersistPrices).toHaveBeenCalledWith(['123', '456'], {
                chainId: 'algorand',
                networkId: 'mainnet',
            })
            expect(invalidateAssetQueries).toHaveBeenCalledWith(queryClient)
        })

        it('does not enrich asset metadata when no holdings changed', async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            const { fetchAndPersistAssets, invalidateAssetQueries } =
                await import('@perawallet/wallet-core-assets')

            vi.mocked(fetchAndPersistAccount).mockResolvedValue({
                changed: true,
                holdingsChanged: false,
                observedRound: null,
            })

            await service.refreshAccounts(['ADDR1'], MAINNET)

            expect(fetchAndPersistAssets).not.toHaveBeenCalled()
            expect(invalidateAssetQueries).not.toHaveBeenCalled()

            vi.mocked(fetchAndPersistAccount).mockImplementation(() =>
                Promise.resolve({ changed: true, holdingsChanged: true }),
            )
        })

        it('never throws and still invalidates account/tx queries when asset enrichment fails', async () => {
            const { getAllHeldAssetIdsForNetwork, invalidateAccountQueries } =
                await import('@perawallet/wallet-core-accounts')
            const { invalidateTransactionQueriesForAddresses } =
                await import('@perawallet/wallet-core-transactions')

            vi.mocked(getAllHeldAssetIdsForNetwork).mockRejectedValueOnce(
                new Error('db read blew up'),
            )

            await expect(
                service.refreshAccounts(['ADDR1'], MAINNET),
            ).resolves.toBeUndefined()

            // Default mock reports holdingsChanged → broad accounts pass.
            expect(invalidateAccountQueries).toHaveBeenCalledWith(queryClient)
            expect(
                invalidateTransactionQueriesForAddresses,
            ).toHaveBeenCalledWith(queryClient, ['ADDR1'], MAINNET, {
                shouldRefetchAllPages: true,
            })
        })
    })

    it('logs non-429 failures for assets and transactions phases', async () => {
        const { fetchAndPersistAssets } =
            await import('@perawallet/wallet-core-assets')
        const { fetchAndPersistTransactions } =
            await import('@perawallet/wallet-core-transactions')
        const { logger } = await import('@perawallet/wallet-core-shared')

        vi.mocked(fetchAndPersistAssets).mockRejectedValueOnce(
            new Error('asset fetch blew up'),
        )
        vi.mocked(fetchAndPersistTransactions).mockRejectedValueOnce(
            new Error('tx fetch blew up'),
        )

        service.start()
        await vi.advanceTimersByTimeAsync(50)
        service.stop()

        expect(logger.warn).toHaveBeenCalledWith(
            'Sync step failed',
            expect.objectContaining({ phase: 'asset-metadata-or-prices' }),
        )
        expect(logger.warn).toHaveBeenCalledWith(
            'Sync step failed',
            expect.objectContaining({ phase: 'transactions' }),
        )

        vi.mocked(fetchAndPersistAssets).mockImplementation(() =>
            Promise.resolve(),
        )
        vi.mocked(fetchAndPersistTransactions).mockImplementation(() =>
            Promise.resolve(),
        )
    })

    it('does not invalidate account queries when all account fetches are rate-limited', async () => {
        const {
            fetchAndPersistAccount,
            invalidateAccountQueries,
            invalidateAccountQueriesForAddresses,
        } = await import('@perawallet/wallet-core-accounts')

        vi.mocked(fetchAndPersistAccount).mockRejectedValue(
            peraNetworkError(429),
        )

        service.start()
        await vi.advanceTimersByTimeAsync(50)
        service.stop()

        // No account fetch succeeded, so no per-account invalidation: nothing
        // account-scoped changed in the DB, and eagerly invalidating would
        // force a wide re-read with no new data. The asset/price phase still
        // ran and persisted, so its broad invalidation is owed — stop() flushes
        // it rather than dropping it.
        expect(invalidateAccountQueriesForAddresses).not.toHaveBeenCalled()
        expect(invalidateAccountQueries).toHaveBeenCalledWith(queryClient)
    })

    it('does not invalidate asset queries when every asset and price batch fails', async () => {
        const { fetchAndPersistAssets, invalidateAssetQueries } =
            await import('@perawallet/wallet-core-assets')
        const { fetchAndPersistPrices } =
            await import('@perawallet/wallet-core-assets')

        vi.mocked(fetchAndPersistAssets).mockRejectedValue(
            new Error('asset fetch blew up'),
        )
        vi.mocked(fetchAndPersistPrices).mockRejectedValue(
            new Error('price fetch blew up'),
        )

        service.start()
        await vi.advanceTimersByTimeAsync(50)
        service.stop()

        // When every batch in the assets phase rejects, invalidation would
        // force a re-read from DB with no new data — so we skip it.
        expect(invalidateAssetQueries).not.toHaveBeenCalled()

        vi.mocked(fetchAndPersistAssets).mockImplementation(() =>
            Promise.resolve(),
        )
        vi.mocked(fetchAndPersistPrices).mockImplementation(() =>
            Promise.resolve(),
        )
    })

    it('invalidates only the changed accounts after the debounce window', async () => {
        const { fetchAndPersistAccount, invalidateAccountQueriesForAddresses } =
            await import('@perawallet/wallet-core-accounts')

        vi.mocked(fetchAndPersistAccount).mockImplementation(async address =>
            address === 'ADDR1'
                ? { changed: true, holdingsChanged: false }
                : { changed: false, holdingsChanged: false },
        )
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        service.start()
        // Let the async first tick complete, then wait out the 250ms debounce.
        await vi.advanceTimersByTimeAsync(400)
        service.stop()

        expect(invalidateAccountQueriesForAddresses).toHaveBeenCalledWith(
            queryClient,
            ['ADDR1'],
        )
    })

    describe('pollIntervalMs', () => {
        it('uses the injected pollIntervalMs as the reschedule cadence', async () => {
            const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
            const custom = new SyncService({
                queryClient,
                stores: createSyncStorePorts(),
                chains: chainsDep(),
                pollIntervalMs: 12345,
            })

            custom.start()
            await vi.advanceTimersByTimeAsync(0)
            custom.stop()

            expect(
                setTimeoutSpy.mock.calls.some(call => call[1] === 12345),
            ).toBe(true)

            setTimeoutSpy.mockRestore()
        })
    })

    it('does not invalidate transaction queries when every account transaction fetch fails', async () => {
        const {
            fetchAndPersistTransactions,
            invalidateTransactionQueries,
            invalidateTransactionQueriesForScope,
        } = await import('@perawallet/wallet-core-transactions')

        vi.mocked(fetchAndPersistTransactions).mockRejectedValue(
            new Error('tx fetch blew up'),
        )

        service.start()
        await vi.advanceTimersByTimeAsync(50)
        service.stop()

        // When every account's transaction fetch rejects, invalidation
        // would force a re-read from DB with no new data — so we skip it.
        expect(invalidateTransactionQueries).not.toHaveBeenCalled()
        expect(invalidateTransactionQueriesForScope).not.toHaveBeenCalled()

        vi.mocked(fetchAndPersistTransactions).mockImplementation(() =>
            Promise.resolve(),
        )
    })

    describe('connectivity awareness', () => {
        // onlineManager is a process-wide singleton shared with the rest of the
        // suite (which assumes online). Restore it after each test here.
        afterEach(() => {
            onlineManager.setOnline(true)
        })

        it('performs zero network calls while offline but stays scheduled', async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            mockSendShouldRefreshRequest.mockResolvedValue({
                refresh: true,
                round: 1,
            })

            onlineManager.setOnline(false)

            service.start()
            await flushMicrotasks()
            // Even after a full base interval elapses, nothing should fire.
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            await flushMicrotasks()

            expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
            expect(fetchAndPersistAccount).not.toHaveBeenCalled()
            // The loop is not dead — it remains cheaply scheduled.
            expect(service.isRunning()).toBe(true)

            service.stop()
        })

        it('runs a sync tick immediately on reconnect', async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')

            onlineManager.setOnline(false)
            service.start()
            await flushMicrotasks()

            // Offline: no sync has run yet.
            expect(fetchAndPersistAccount).not.toHaveBeenCalled()

            // Reconnect — a tick should fire immediately, without waiting for the
            // next scheduled interval.
            onlineManager.setOnline(true)
            await flushMicrotasks()

            expect(fetchAndPersistAccount).toHaveBeenCalled()

            service.stop()
        })
    })

    describe('Pera-backed network gating', () => {
        // custom has no Pera backend deployment — sendShouldRefreshRequest
        // would reject with PeraServiceUnavailableError on every tick, and
        // (pre-fix) that rethrow engaged the tick's backoff until chain sync
        // stopped entirely. checkShouldRefresh must short-circuit before
        // issuing the request for these networks instead.
        it('keeps syncing a Pera-less network (custom) on subsequent ticks without ever calling should-refresh', async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            const { useSyncCursorStore } = await import('../polling')

            mockNetwork = 'custom'
            // Already synced (a number, not null) so neverSynced is false —
            // the pre-fix code path reaches sendShouldRefreshRequest here.
            useSyncCursorStore.getState = vi.fn(() =>
                cursorState({
                    'algorand/mainnet': null,
                    'algorand/testnet': null,
                    'algorand/custom': 100,
                }),
            )
            mockSendShouldRefreshRequest.mockRejectedValue(
                new Error('PeraServiceUnavailableError'),
            )

            try {
                service.start()

                // First tick: unconditional force-sync (skips checkShouldRefresh).
                await vi.advanceTimersByTimeAsync(50)
                vi.mocked(fetchAndPersistAccount).mockClear()

                // Second tick: goes through checkShouldRefresh. The guard must
                // return early so the chain sync still runs on this tick.
                await vi.advanceTimersByTimeAsync(3100)

                service.stop()

                expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
                expect(fetchAndPersistAccount).toHaveBeenCalled()
            } finally {
                useSyncCursorStore.getState = () =>
                    cursorState({
                        'algorand/mainnet': null,
                        'algorand/testnet': null,
                    })
            }
        })

        it('control: still calls should-refresh for a Pera-backed network (mainnet)', async () => {
            const { useSyncCursorStore } = await import('../polling')

            useSyncCursorStore.getState = vi.fn(() =>
                cursorState({
                    'algorand/mainnet': 100,
                    'algorand/testnet': null,
                }),
            )
            mockSendShouldRefreshRequest.mockResolvedValue({
                refresh: false,
                round: null,
            })

            try {
                service.start()

                await vi.advanceTimersByTimeAsync(50)
                await vi.advanceTimersByTimeAsync(3100)

                service.stop()

                expect(mockSendShouldRefreshRequest).toHaveBeenCalledWith(
                    'mainnet',
                    ['ADDR1', 'ADDR2'],
                    100,
                )
            } finally {
                useSyncCursorStore.getState = () =>
                    cursorState({
                        'algorand/mainnet': null,
                        'algorand/testnet': null,
                    })
            }
        })
    })

    describe('failure-aware backoff', () => {
        // Put every network call in a failing (non-429) state, so syncAll
        // absorbs them via allSettled and returns WITHOUT throwing.
        const makeEverythingFail = async (): Promise<void> => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            const { fetchAndPersistAssets, fetchAndPersistPrices } =
                await import('@perawallet/wallet-core-assets')
            const { fetchAndPersistTransactions } =
                await import('@perawallet/wallet-core-transactions')
            vi.mocked(fetchAndPersistAccount).mockRejectedValue(
                new Error('network error'),
            )
            vi.mocked(fetchAndPersistAssets).mockRejectedValue(
                new Error('network error'),
            )
            vi.mocked(fetchAndPersistPrices).mockRejectedValue(
                new Error('network error'),
            )
            vi.mocked(fetchAndPersistTransactions).mockRejectedValue(
                new Error('network error'),
            )
            // Keep subsequent ticks syncing so we can observe when they fire.
            mockSendShouldRefreshRequest.mockResolvedValue({
                refresh: true,
                round: null,
            })
        }

        it('backs off on a partial account failure so the frozen checkpoint does not storm', async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            mockSendShouldRefreshRequest.mockResolvedValue({
                refresh: true,
                round: 42,
            })
            // One failing account freezes the checkpoint, so every tick would
            // re-sync the whole network. Backing off bounds that retry.
            vi.mocked(fetchAndPersistAccount).mockImplementation(
                async (address: string) => {
                    if (address === 'ADDR2') {
                        throw new Error('indexer hiccup')
                    }
                    return {
                        changed: false,
                        holdingsChanged: false,
                        observedRound: 42,
                    }
                },
            )

            service.start()
            await flushMicrotasks() // tick 1: partial failure → back off to 6000
            const callsAfterTick1 = vi.mocked(fetchAndPersistAccount).mock.calls
                .length
            expect(callsAfterTick1).toBeGreaterThan(0)

            // At the base interval no new tick fires — the loop backed off.
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            await flushMicrotasks()
            expect(vi.mocked(fetchAndPersistAccount).mock.calls.length).toBe(
                callsAfterTick1,
            )

            // At the doubled interval the retry fires.
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            await flushMicrotasks()
            expect(
                vi.mocked(fetchAndPersistAccount).mock.calls.length,
            ).toBeGreaterThan(callsAfterTick1)

            service.stop()
        })

        it('doubles the interval when a tick makes no successful progress even though syncAll does not throw', async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            await makeEverythingFail()

            service.start()
            await flushMicrotasks() // tick 1: every call fails → back off to 6000
            const callsAfterTick1 = vi.mocked(fetchAndPersistAccount).mock.calls
                .length
            expect(callsAfterTick1).toBeGreaterThan(0)

            // Base interval is 3000; if the loop backed off, the next tick will
            // NOT fire until 6000ms — so at +3000 there is still no new tick.
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            await flushMicrotasks()
            expect(vi.mocked(fetchAndPersistAccount).mock.calls.length).toBe(
                callsAfterTick1,
            )

            // At +6000 the doubled interval elapses and the next tick fires.
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            await flushMicrotasks()
            expect(
                vi.mocked(fetchAndPersistAccount).mock.calls.length,
            ).toBeGreaterThan(callsAfterTick1)

            service.stop()
        })

        it('caps the backoff at MAX_BACKOFF_INTERVAL under sustained failure', async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            await makeEverythingFail()

            service.start()
            await flushMicrotasks() // tick1 → 6000
            await vi.advanceTimersByTimeAsync(6000)
            await flushMicrotasks() // tick2 → 12000
            await vi.advanceTimersByTimeAsync(12000)
            await flushMicrotasks() // tick3 → 24000
            await vi.advanceTimersByTimeAsync(24000)
            await flushMicrotasks() // tick4 → 48000, capped to 30000

            const callsAtCap = vi.mocked(fetchAndPersistAccount).mock.calls
                .length

            // The interval is capped at MAX (30000), not still doubling to
            // 48000. Just under MAX, no new tick fires (this also fails loudly if
            // the loop never backed off and is still ticking at the base 3000ms).
            await vi.advanceTimersByTimeAsync(MAX_BACKOFF_INTERVAL - 1)
            await flushMicrotasks()
            expect(vi.mocked(fetchAndPersistAccount).mock.calls.length).toBe(
                callsAtCap,
            )

            // And it does not exceed MAX: one more millisecond fires the tick.
            await vi.advanceTimersByTimeAsync(1)
            await flushMicrotasks()
            expect(
                vi.mocked(fetchAndPersistAccount).mock.calls.length,
            ).toBeGreaterThan(callsAtCap)

            service.stop()
        })

        it('backs off when shouldRefresh keeps failing after the first sync', async () => {
            const { useSyncCursorStore } = await import('../polling')
            const originalGetState = useSyncCursorStore.getState
            useSyncCursorStore.getState = (() =>
                cursorState({
                    'algorand/mainnet': 42,
                    'algorand/testnet': null,
                })) as typeof useSyncCursorStore.getState

            mockSendShouldRefreshRequest.mockRejectedValue(
                new Error('HTTP 500 Internal Server Error'),
            )

            service.start()
            await flushMicrotasks() // tick 1: initial force-sync, no shouldRefresh
            expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()

            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            await flushMicrotasks() // tick 2: shouldRefresh fails → back off
            expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)

            // Without backoff the next attempt would fire at +3000 already.
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            await flushMicrotasks()
            expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)

            // The doubled interval elapses → next attempt fires.
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            await flushMicrotasks()
            expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(2)

            service.stop()
            useSyncCursorStore.getState = originalGetState
            mockSendShouldRefreshRequest.mockReset()
        })

        it('resets to the base interval after a successful tick following a backoff', async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            const { fetchAndPersistAssets, fetchAndPersistPrices } =
                await import('@perawallet/wallet-core-assets')
            const { fetchAndPersistTransactions } =
                await import('@perawallet/wallet-core-transactions')

            await makeEverythingFail()
            service.start()
            await flushMicrotasks() // tick1: total failure → back off to 6000

            // Recover: every call now succeeds again.
            vi.mocked(fetchAndPersistAccount).mockResolvedValue({
                changed: true,
                holdingsChanged: false,
            })
            vi.mocked(fetchAndPersistAssets).mockResolvedValue()
            vi.mocked(fetchAndPersistPrices).mockResolvedValue()
            vi.mocked(fetchAndPersistTransactions).mockResolvedValue()

            // tick2 fires at the backed-off +6000 and succeeds → interval resets.
            await vi.advanceTimersByTimeAsync(6000)
            await flushMicrotasks()
            const callsAfterRecovery = vi.mocked(fetchAndPersistAccount).mock
                .calls.length

            // If the interval reset to base, tick3 fires again after just 3000ms
            // (not another 6000+). This is the "success reset" guarantee.
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            await flushMicrotasks()
            expect(
                vi.mocked(fetchAndPersistAccount).mock.calls.length,
            ).toBeGreaterThan(callsAfterRecovery)

            service.stop()
        })
    })

    describe('injected store ports', () => {
        it('syncs the ported accounts on the ported network and writes the checkpoint back through the ports', async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            vi.mocked(fetchAndPersistAccount).mockResolvedValue({
                changed: false,
                holdingsChanged: false,
                observedRound: 77,
            } as never)
            const stores: SyncServiceDeps['stores'] = {
                getAccountChainAddresses: vi.fn(() => [
                    { chainId: 'algorand' as const, address: 'PORT1' },
                ]),
                getSelectedScope: vi.fn(() => TESTNET),
                getChangeCursor: vi.fn(() => null),
                setChangeCursor: vi.fn(),
                getLastSyncAt: vi.fn(() => null),
                setLastSyncAt: vi.fn(),
            }
            const ported = new SyncService({
                queryClient,
                stores,
                chains: chainsDep(),
            })

            ported.start()
            await flushMicrotasks()
            ported.stop()

            expect(fetchAndPersistAccount).toHaveBeenCalledTimes(1)
            expect(fetchAndPersistAccount).toHaveBeenCalledWith('PORT1', {
                chainId: 'algorand',
                networkId: 'testnet',
            })
            expect(stores.setChangeCursor).toHaveBeenCalledWith(TESTNET, 77)
            expect(mockSetRefreshRound).not.toHaveBeenCalled()
            expect(stores.setLastSyncAt).toHaveBeenCalledWith(
                TESTNET,
                'prices',
                Date.now(),
            )
            expect(mockMarkSynced).not.toHaveBeenCalled()
        })
    })

    describe('persisted asset and price cursors', () => {
        beforeEach(async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            // No holdings change, so only the persisted timestamps decide
            // whether the asset passes are due.
            vi.mocked(fetchAndPersistAccount).mockResolvedValue({
                changed: false,
                holdingsChanged: false,
            } as never)
        })

        it('marks each successful pass synced under the scope it ran for', async () => {
            service.start()
            await flushMicrotasks()
            service.stop()

            expect(mockMarkSynced).toHaveBeenCalledWith(
                MAINNET,
                'assets',
                Date.now(),
            )
            expect(mockMarkSynced).toHaveBeenCalledWith(
                MAINNET,
                'prices',
                Date.now(),
            )
        })

        it('does not mark a failed pass synced, so it retries next tick', async () => {
            const { fetchAndPersistPrices } =
                await import('@perawallet/wallet-core-assets')
            vi.mocked(fetchAndPersistPrices).mockRejectedValue(
                new Error('prices down'),
            )

            service.start()
            await flushMicrotasks()
            service.stop()

            expect(mockMarkSynced).toHaveBeenCalledWith(
                MAINNET,
                'assets',
                Date.now(),
            )
            expect(mockMarkSynced).not.toHaveBeenCalledWith(
                MAINNET,
                'prices',
                expect.anything(),
            )
        })

        it('a fresh service resumes the price interval from the persisted cursor instead of re-pricing', async () => {
            const { fetchAndPersistPrices } =
                await import('@perawallet/wallet-core-assets')
            service.start()
            await flushMicrotasks()
            service.stop()
            expect(fetchAndPersistPrices).toHaveBeenCalledTimes(1)

            const relaunched = new SyncService({
                queryClient,
                stores: createSyncStorePorts(),
                chains: chainsDep(),
            })
            relaunched.start()
            await flushMicrotasks()
            relaunched.stop()

            expect(fetchAndPersistPrices).toHaveBeenCalledTimes(1)
        })

        it("switching a network away and back resumes from that scope's cursor", async () => {
            const { fetchAndPersistPrices } =
                await import('@perawallet/wallet-core-assets')
            service.start()
            await flushMicrotasks()

            mockNetwork = 'testnet'
            service.restart()
            await flushMicrotasks()
            // testnet has its own, empty cursor, so it prices straight away.
            expect(fetchAndPersistPrices).toHaveBeenLastCalledWith(
                ['123', '456'],
                { chainId: 'algorand', networkId: 'testnet' },
            )
            vi.mocked(fetchAndPersistPrices).mockClear()

            mockNetwork = 'mainnet'
            service.restart()
            await flushMicrotasks()
            service.stop()

            expect(fetchAndPersistPrices).not.toHaveBeenCalled()
        })

        it('re-prices a scope once its persisted interval has elapsed', async () => {
            const { fetchAndPersistPrices } =
                await import('@perawallet/wallet-core-assets')
            mockSyncedAt['algorand/mainnet'] = {
                assets: Date.now(),
                prices: Date.now() - 60_000,
            }

            service.start()
            await flushMicrotasks()
            service.stop()

            expect(fetchAndPersistPrices).toHaveBeenCalledTimes(1)
        })

        it('treats a persisted timestamp in the future (clock moved back) as due rather than stalling', async () => {
            const { fetchAndPersistAssets, fetchAndPersistPrices } =
                await import('@perawallet/wallet-core-assets')
            const oneDayAhead = Date.now() + 24 * 60 * 60 * 1000
            mockSyncedAt['algorand/mainnet'] = {
                assets: oneDayAhead,
                prices: oneDayAhead,
            }

            service.start()
            await flushMicrotasks()
            service.stop()

            expect(fetchAndPersistAssets).toHaveBeenCalledTimes(1)
            expect(fetchAndPersistPrices).toHaveBeenCalledTimes(1)
            expect(mockMarkSynced).toHaveBeenCalledWith(
                MAINNET,
                'prices',
                Date.now(),
            )
        })
    })
    describe('scopes of several chains', () => {
        const ethereumSignal = vi.fn()
        const ethereumAdapter = (
            overrides: Partial<FixtureAdapter> = {},
        ): FixtureAdapter => ({
            chainId: 'ethereum',
            fetchChangeSignal: ethereumSignal,
            ...overrides,
        })
        const addEthereumAccount = (
            id: string,
            chains: Record<string, { address: string }>,
        ) => {
            mockAccounts.push({
                id,
                name: id,
                custody: { kind: 'watch' },
                chains,
            })
        }
        const accountReadsOn = async (scope: {
            chainId: string
            networkId: string
        }) => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            return vi
                .mocked(fetchAndPersistAccount)
                .mock.calls.filter(
                    ([, readScope]) => readScope.chainId === scope.chainId,
                )
                .map(([address]) => address)
        }

        beforeEach(() => {
            ethereumSignal.mockReset()
            ethereumSignal.mockResolvedValue({ changed: false, cursor: 7 })
            mockAdapters.ethereum = ethereumAdapter()
            mockChainList = [{ id: 'algorand' }, { id: 'ethereum' }]
            mockSendShouldRefreshRequest.mockResolvedValue({
                refresh: true,
                round: 42,
            })
        })

        describe('transaction query invalidation', () => {
            const runOneTick = async () => {
                const { hasCachedHistoryRows } =
                    await import('@perawallet/wallet-core-transactions')
                vi.mocked(hasCachedHistoryRows).mockImplementation(
                    chainId => chainId === 'algorand',
                )
                ethereumSignal.mockResolvedValue({ changed: true, cursor: 8 })
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                service = new SyncService({
                    queryClient,
                    stores: createSyncStorePorts(),
                    chains: chainsDep(),
                })
                service.start()
                await vi.advanceTimersByTimeAsync(50)
                service.stop()
                // Past the invalidation debounce.
                await vi.advanceTimersByTimeAsync(300)
            }

            it("scopes a cached-row chain's invalidation to that chain", async () => {
                const {
                    invalidateTransactionQueries,
                    invalidateTransactionQueriesForScope,
                } = await import('@perawallet/wallet-core-transactions')

                await runOneTick()

                expect(invalidateTransactionQueries).not.toHaveBeenCalled()
                expect(
                    invalidateTransactionQueriesForScope,
                ).toHaveBeenCalledWith(queryClient, MAINNET)
                expect(
                    invalidateTransactionQueriesForScope,
                ).not.toHaveBeenCalledWith(queryClient, ETHEREUM)
            })

            it("keeps every scope's changed accounts when several change in one tick", async () => {
                const { invalidateAccountQueriesForAddresses } =
                    await import('@perawallet/wallet-core-accounts')

                await runOneTick()

                const algorandAddresses = mockAccounts.flatMap(account =>
                    account.chains.algorand
                        ? [account.chains.algorand.address]
                        : [],
                )
                expect(
                    invalidateAccountQueriesForAddresses,
                ).toHaveBeenCalledWith(queryClient, algorandAddresses)
                expect(
                    invalidateAccountQueriesForAddresses,
                ).toHaveBeenCalledWith(queryClient, ['0xabc'])
            })

            it("refreshes a records chain's History for the accounts that changed", async () => {
                const { invalidateTransactionQueriesForAddresses } =
                    await import('@perawallet/wallet-core-transactions')

                await runOneTick()

                expect(
                    invalidateTransactionQueriesForAddresses,
                ).toHaveBeenCalledWith(queryClient, ['0xabc'], ETHEREUM)
            })

            it("leaves a records chain's History alone when none of its accounts changed", async () => {
                const { fetchAndPersistAccount } =
                    await import('@perawallet/wallet-core-accounts')
                const { invalidateTransactionQueriesForAddresses } =
                    await import('@perawallet/wallet-core-transactions')
                vi.mocked(fetchAndPersistAccount).mockImplementation(
                    async (_address, scope) =>
                        scope.chainId === 'ethereum'
                            ? { changed: false, holdingsChanged: false }
                            : { changed: true, holdingsChanged: true },
                )

                await runOneTick()

                expect(
                    invalidateTransactionQueriesForAddresses,
                ).not.toHaveBeenCalledWith(queryClient, ['0xabc'], ETHEREUM)
            })
        })

        it("calls each scope's adapter once per tick and leaves Algorand's calls as they were", async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            const runTwoTicks = async (target: SyncService) => {
                mockSendShouldRefreshRequest.mockClear()
                vi.mocked(fetchAndPersistAccount).mockClear()
                target.start()
                await vi.advanceTimersByTimeAsync(50)
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                target.stop()
                return {
                    signal: [...mockSendShouldRefreshRequest.mock.calls],
                    reads: await accountReadsOn(MAINNET),
                }
            }
            const algorandOnly = await runTwoTicks(service)

            addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
            service = new SyncService({
                queryClient,
                stores: createSyncStorePorts(),
                chains: chainsDep(),
            })
            const withEthereum = await runTwoTicks(service)

            expect(withEthereum).toEqual(algorandOnly)
            expect(ethereumSignal).toHaveBeenCalledTimes(1)
            expect(ethereumSignal).toHaveBeenCalledWith(
                ['0xabc'],
                ETHEREUM,
                null,
            )
            // The forced first tick reads it; the clean signal skips the second.
            expect(await accountReadsOn(ETHEREUM)).toEqual(['0xabc'])
        })

        it('reads an account with entries on two chains once on each scope', async () => {
            addEthereumAccount('both', {
                algorand: { address: 'ADDR3' },
                ethereum: { address: '0xabc' },
            })

            service.start()
            await vi.advanceTimersByTimeAsync(50)
            service.stop()

            expect(await accountReadsOn(MAINNET)).toEqual([
                'ADDR1',
                'ADDR2',
                'ADDR3',
            ])
            expect(await accountReadsOn(ETHEREUM)).toEqual(['0xabc'])
        })

        it('reads a chain without a change signal on every tick', async () => {
            mockAdapters.ethereum = ethereumAdapter({
                fetchChangeSignal: undefined,
            })
            mockSendShouldRefreshRequest.mockResolvedValue({
                refresh: false,
                round: null,
            })
            addEthereumAccount('eth', { ethereum: { address: '0xabc' } })

            service.start()
            await vi.advanceTimersByTimeAsync(50)
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            service.stop()

            expect(await accountReadsOn(ETHEREUM)).toEqual([
                '0xabc',
                '0xabc',
                '0xabc',
            ])
        })

        it('prices each scope whose chain registers an assets adapter', async () => {
            const { fetchAndPersistPrices } =
                await import('@perawallet/wallet-core-assets')
            mockAssetsChains.add('ethereum')
            addEthereumAccount('eth', { ethereum: { address: '0xabc' } })

            service.start()
            await vi.advanceTimersByTimeAsync(50)
            service.stop()

            const pricedScopes = vi
                .mocked(fetchAndPersistPrices)
                .mock.calls.map(([, scope]) => scope)
            expect(pricedScopes).toEqual([MAINNET, ETHEREUM])
        })

        it('skips pricing a scope whose chain has no assets adapter, leaving Algorand priced', async () => {
            const { fetchAndPersistPrices } =
                await import('@perawallet/wallet-core-assets')
            addEthereumAccount('eth', { ethereum: { address: '0xabc' } })

            service.start()
            await vi.advanceTimersByTimeAsync(50)
            service.stop()

            const pricedScopes = vi
                .mocked(fetchAndPersistPrices)
                .mock.calls.map(([, scope]) => scope)
            expect(pricedScopes).toEqual([MAINNET])
        })

        describe('cursor', () => {
            const ethereumCursorWrites = () =>
                mockSetRefreshRound.mock.calls.filter(
                    ([scope]) => scope.chainId === 'ethereum',
                )

            const runChangedTick = async (
                rounds: Record<string, number | null | Error>,
            ) => {
                const { fetchAndPersistAccount } =
                    await import('@perawallet/wallet-core-accounts')
                vi.mocked(fetchAndPersistAccount).mockImplementation(
                    async (address: string) => {
                        const round = rounds[address]
                        if (round instanceof Error) throw round
                        return {
                            changed: false,
                            holdingsChanged: false,
                            observedRound: round ?? null,
                        }
                    },
                )
                ethereumSignal.mockResolvedValue({ changed: true, cursor: 200 })
                Object.keys(rounds).forEach(address =>
                    addEthereumAccount(address, {
                        ethereum: { address },
                    }),
                )

                service.start()
                await vi.advanceTimersByTimeAsync(50)
                mockSetRefreshRound.mockClear()
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                service.stop()
                return ethereumCursorWrites()
            }

            it('advances to the lowest observed round of a clean pass', async () => {
                const writes = await runChangedTick({
                    '0xa': 120,
                    '0xb': 110,
                })

                expect(writes).toEqual([[ETHEREUM, 110]])
            })

            it('stays put after any failed read', async () => {
                const writes = await runChangedTick({
                    '0xa': 120,
                    '0xb': new Error('rpc down'),
                })

                expect(writes).toEqual([])
            })

            it("takes the signal's cursor when no read reported a round", async () => {
                const writes = await runChangedTick({ '0xa': null })

                expect(writes).toEqual([[ETHEREUM, 200]])
            })

            it("keeps the signal's cursor when nothing changed, writing it only when it moved forward", async () => {
                const { useSyncCursorStore } = await import('../polling')
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                ethereumSignal.mockResolvedValue({
                    changed: false,
                    cursor: 300,
                })

                service.start()
                await vi.advanceTimersByTimeAsync(50)
                mockSetRefreshRound.mockClear()
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                expect(ethereumCursorWrites()).toEqual([[ETHEREUM, 300]])

                const original = useSyncCursorStore.getState
                useSyncCursorStore.getState = () =>
                    cursorState({ 'ethereum/mainnet': 300 }) as never
                try {
                    mockSetRefreshRound.mockClear()
                    await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                    expect(ethereumCursorWrites()).toEqual([])

                    // A signal behind the stored cursor never rewinds it.
                    useSyncCursorStore.getState = () =>
                        cursorState({ 'ethereum/mainnet': 400 }) as never
                    await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                    expect(ethereumCursorWrites()).toEqual([])
                } finally {
                    useSyncCursorStore.getState = original
                    service.stop()
                }
            })

            it('writes nothing when the signal omits its cursor', async () => {
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                ethereumSignal.mockResolvedValue({
                    changed: false,
                    cursor: undefined,
                })

                service.start()
                await vi.advanceTimersByTimeAsync(50)
                mockSetRefreshRound.mockClear()
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                service.stop()

                expect(ethereumCursorWrites()).toEqual([])
            })
        })

        it("starts every read of an uncapped chain's scope together, and caps Algorand's", async () => {
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')
            const addresses = Array.from({ length: 10 }, (_, i) => `0x${i}`)
            addresses.forEach(address =>
                addEthereumAccount(address, { ethereum: { address } }),
            )
            let release = (): void => {}
            const gate = new Promise<void>(resolve => {
                release = resolve
            })
            let started = 0
            vi.mocked(fetchAndPersistAccount).mockImplementation(
                async (_address, scope) => {
                    if (scope.chainId === 'ethereum') {
                        started += 1
                        await gate
                    }
                    return {
                        changed: false,
                        holdingsChanged: false,
                        observedRound: null,
                    }
                },
            )

            service.start()
            await vi.advanceTimersByTimeAsync(50)
            const startedBeforeAnySettled = started
            release()
            await vi.advanceTimersByTimeAsync(50)
            service.stop()

            expect(startedBeforeAnySettled).toBe(10)
            expect(
                mockConcurrencyLimits.find(call => call.items[0] === '0x0')
                    ?.limit,
            ).toBe(10)
            expect(
                mockConcurrencyLimits.find(call => call.items[0] === 'ADDR1')
                    ?.limit,
            ).toBe(6)
        })

        it("keeps Algorand at the base interval while another scope's signal throws, backing off only that scope", async () => {
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { useSyncCursorStore } = await import('../polling')
            const original = useSyncCursorStore.getState
            // A synced scope: a never-synced one would fall back to a read.
            useSyncCursorStore.getState = () =>
                cursorState({ 'ethereum/mainnet': 5 }) as never
            addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
            ethereumSignal.mockRejectedValue(new Error('rpc down'))
            const { fetchAndPersistAccount } =
                await import('@perawallet/wallet-core-accounts')

            try {
                service.start()
                await vi.advanceTimersByTimeAsync(50)
                vi.mocked(fetchAndPersistAccount).mockClear()
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)

                expect(await accountReadsOn(MAINNET)).toEqual([
                    'ADDR1',
                    'ADDR2',
                ])
                expect(await accountReadsOn(ETHEREUM)).toEqual([])
                expect(logger.warn).toHaveBeenCalledWith(
                    'Sync scope failed',
                    expect.objectContaining({ scope: ETHEREUM }),
                )

                // Algorand stays on the base interval; only Ethereum waits.
                vi.mocked(fetchAndPersistAccount).mockClear()
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                expect(await accountReadsOn(MAINNET)).toEqual([
                    'ADDR1',
                    'ADDR2',
                ])
                expect(ethereumSignal).toHaveBeenCalledTimes(1)

                // Ethereum's own 6 s backoff has elapsed.
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                expect(ethereumSignal).toHaveBeenCalledTimes(2)
            } finally {
                useSyncCursorStore.getState = original
                service.stop()
            }
        })

        describe('per-scope backoff', () => {
            const rateLimited = () =>
                Object.assign(new Error('HTTP request failed.'), {
                    status: 429,
                })
            const OK_READ = {
                changed: false,
                holdingsChanged: false,
                observedRound: 42,
            }

            const failEthereumReads = async () => {
                const { fetchAndPersistAccount } =
                    await import('@perawallet/wallet-core-accounts')
                vi.mocked(fetchAndPersistAccount).mockImplementation(
                    async (_address, scope) => {
                        if (scope.chainId === 'ethereum') throw rateLimited()
                        return OK_READ
                    },
                )
                ethereumSignal.mockRejectedValue(rateLimited())
                return fetchAndPersistAccount
            }

            it('syncs Algorand at the base interval while Ethereum is rate limited', async () => {
                const { logger } =
                    await import('@perawallet/wallet-core-shared')
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                await failEthereumReads()

                service.start()
                await vi.advanceTimersByTimeAsync(50 + 5 * POLL_INTERVAL)
                service.stop()

                expect(await accountReadsOn(MAINNET)).toHaveLength(12)
                expect(await accountReadsOn(ETHEREUM)).toEqual([
                    '0xabc',
                    '0xabc',
                ])
                expect(ethereumSignal).toHaveBeenCalledTimes(1)
                expect(logger.warn).toHaveBeenCalledWith(
                    'Sync scope rate limited',
                    { scope: ETHEREUM },
                )
                expect(logger.warn).not.toHaveBeenCalledWith(
                    'Sync step failed',
                    expect.objectContaining({ scope: ETHEREUM }),
                )
            })

            it('reports a synced scope whose signal is rejected with a 429 as rate limited', async () => {
                const { logger } =
                    await import('@perawallet/wallet-core-shared')
                const { useSyncCursorStore } = await import('../polling')
                const original = useSyncCursorStore.getState
                useSyncCursorStore.getState = () =>
                    cursorState({ 'ethereum/mainnet': 5 }) as never
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                ethereumSignal.mockRejectedValue(rateLimited())

                try {
                    service.start()
                    // A scope's first sync skips its signal; the second asks.
                    await vi.advanceTimersByTimeAsync(50 + POLL_INTERVAL)
                    service.stop()

                    expect(ethereumSignal).toHaveBeenCalledTimes(1)
                    expect(logger.warn).toHaveBeenCalledWith(
                        'Sync scope rate limited',
                        { scope: ETHEREUM },
                    )
                    expect(logger.warn).not.toHaveBeenCalledWith(
                        'Sync scope failed',
                        expect.objectContaining({ scope: ETHEREUM }),
                    )
                } finally {
                    useSyncCursorStore.getState = original
                }
            })

            it('backs off a rate-limited scope on its own and resumes the base cadence once it recovers', async () => {
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                const fetchAndPersistAccount = await failEthereumReads()

                service.start()
                await vi.advanceTimersByTimeAsync(50 + 2 * POLL_INTERVAL)
                expect(await accountReadsOn(ETHEREUM)).toHaveLength(2)

                // Ethereum's interval is now 12 s, so it is next due at 18 s.
                vi.mocked(fetchAndPersistAccount).mockResolvedValue(OK_READ)
                ethereumSignal.mockResolvedValue({ changed: true, cursor: 9 })
                vi.mocked(fetchAndPersistAccount).mockClear()
                await vi.advanceTimersByTimeAsync(3 * POLL_INTERVAL)
                expect(await accountReadsOn(ETHEREUM)).toEqual([])

                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                expect(await accountReadsOn(ETHEREUM)).toEqual(['0xabc'])

                vi.mocked(fetchAndPersistAccount).mockClear()
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                service.stop()
                expect(await accountReadsOn(ETHEREUM)).toEqual(['0xabc'])
            })

            it('backs off the loop when every scope that ran fails', async () => {
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                const { fetchAndPersistAccount } =
                    await import('@perawallet/wallet-core-accounts')
                vi.mocked(fetchAndPersistAccount).mockRejectedValue(
                    new Error('network error'),
                )

                service.start()
                await vi.advanceTimersByTimeAsync(50)
                expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(1)

                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(1)
                expect(await accountReadsOn(MAINNET)).toHaveLength(2)
                expect(await accountReadsOn(ETHEREUM)).toHaveLength(1)

                // Each scope's own backoff elapses together with the loop's.
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                service.stop()
                expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(2)
                expect(await accountReadsOn(MAINNET)).toHaveLength(4)
                expect(ethereumSignal).toHaveBeenCalledTimes(1)
            })

            it("runs scopes concurrently, so a slow scope does not hold up the next one's reads", async () => {
                const { fetchAndPersistAccount } =
                    await import('@perawallet/wallet-core-accounts')
                let releaseGate: () => void = () => {}
                const gate = new Promise<void>(resolve => {
                    releaseGate = resolve
                })
                vi.mocked(fetchAndPersistAccount).mockImplementation(
                    async (_address, scope) => {
                        if (scope.chainId === 'ethereum') await gate
                        return OK_READ
                    },
                )
                const ordered = new SyncService({
                    queryClient,
                    stores: {
                        ...createSyncStorePorts(),
                        getAccountChainAddresses: () => [
                            { chainId: 'ethereum', address: '0xabc' },
                            { chainId: 'algorand', address: 'ADDR1' },
                        ],
                    },
                    chains: chainsDep(),
                })

                try {
                    ordered.start()
                    await vi.advanceTimersByTimeAsync(50)

                    expect(await accountReadsOn(MAINNET)).toEqual(['ADDR1'])
                } finally {
                    releaseGate()
                    ordered.stop()
                }
            })

            it('syncs a backed-off scope again after the device clock moves back', async () => {
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                await failEthereumReads()

                service.start()
                await vi.advanceTimersByTimeAsync(50)
                expect(await accountReadsOn(ETHEREUM)).toHaveLength(1)

                vi.setSystemTime(Date.now() - 60 * 60 * 1000)
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                service.stop()

                expect(await accountReadsOn(ETHEREUM)).toHaveLength(2)
            })

            it('leaves the loop interval alone on a tick where every scope is still waiting', async () => {
                mockAccounts.splice(0)
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                await failEthereumReads()

                try {
                    service.start()
                    await vi.advanceTimersByTimeAsync(50)
                    expect(await accountReadsOn(ETHEREUM)).toHaveLength(1)

                    // The loop timer now fires before the scope's wait ends.
                    vi.setSystemTime(Date.now() - 500)
                    await vi.advanceTimersByTimeAsync(2 * POLL_INTERVAL + 100)
                    expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(
                        2,
                    )
                    expect(await accountReadsOn(ETHEREUM)).toHaveLength(1)

                    await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                    expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(
                        2,
                    )
                } finally {
                    service.stop()
                    mockAccounts.push(
                        {
                            id: '1',
                            name: 'Account 1',
                            custody: { kind: 'watch' },
                            chains: { algorand: { address: 'ADDR1' } },
                        },
                        {
                            id: '2',
                            name: 'Account 2',
                            custody: { kind: 'watch' },
                            chains: { algorand: { address: 'ADDR2' } },
                        },
                    )
                }
            })

            it('syncs a scope on the tick its wait ends even when the loop timer fires slightly early', async () => {
                mockAccounts.splice(0)
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                const fetchAndPersistAccount = await failEthereumReads()
                vi.mocked(fetchAndPersistAccount).mockImplementation(
                    async () => {
                        await new Promise(resolve => setTimeout(resolve, 100))
                        throw rateLimited()
                    },
                )

                try {
                    service.start()
                    await vi.advanceTimersByTimeAsync(150)
                    expect(await accountReadsOn(ETHEREUM)).toHaveLength(1)

                    // Scope and loop both wait 6 s; the timer lands 50 ms short.
                    vi.setSystemTime(Date.now() - 50)
                    await vi.advanceTimersByTimeAsync(2 * POLL_INTERVAL)
                    expect(await accountReadsOn(ETHEREUM)).toHaveLength(2)
                } finally {
                    service.stop()
                    mockAccounts.push(
                        {
                            id: '1',
                            name: 'Account 1',
                            custody: { kind: 'watch' },
                            chains: { algorand: { address: 'ADDR1' } },
                        },
                        {
                            id: '2',
                            name: 'Account 2',
                            custody: { kind: 'watch' },
                            chains: { algorand: { address: 'ADDR2' } },
                        },
                    )
                }
            })

            it('forgets a backed-off scope once it leaves the synced set, so switching it back on syncs at once and backs off from base', async () => {
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                await failEthereumReads()

                service.start()
                await vi.advanceTimersByTimeAsync(50 + 2 * POLL_INTERVAL)
                // Ethereum's interval is now 12 s, next due at 18 s.
                expect(await accountReadsOn(ETHEREUM)).toHaveLength(2)

                mockSwitchedOff.add('ethereum')
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                mockSwitchedOff.delete('ethereum')
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                expect(await accountReadsOn(ETHEREUM)).toHaveLength(3)

                // That failure starts again from the base step: due 6 s later.
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                expect(await accountReadsOn(ETHEREUM)).toHaveLength(3)
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                service.stop()
                expect(await accountReadsOn(ETHEREUM)).toHaveLength(4)
            })

            it('forgets per-scope backoff on reconnect, so the reconnect tick syncs every scope', async () => {
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                await failEthereumReads()

                try {
                    service.start()
                    await vi.advanceTimersByTimeAsync(50)
                    expect(await accountReadsOn(ETHEREUM)).toHaveLength(1)

                    onlineManager.setOnline(false)
                    onlineManager.setOnline(true)
                    await vi.advanceTimersByTimeAsync(50)

                    expect(await accountReadsOn(ETHEREUM)).toHaveLength(2)
                } finally {
                    onlineManager.setOnline(true)
                    service.stop()
                }
            })

            it('forgets per-scope backoff on restart', async () => {
                addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
                await failEthereumReads()

                service.start()
                await vi.advanceTimersByTimeAsync(50)
                expect(await accountReadsOn(ETHEREUM)).toHaveLength(1)

                service.restart()
                await vi.advanceTimersByTimeAsync(50)
                service.stop()

                expect(await accountReadsOn(ETHEREUM)).toHaveLength(2)
            })
        })

        it('keeps the base interval when there are no scopes to sync', async () => {
            mockAccounts.splice(0)

            try {
                service.start()
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 50)
                service.stop()

                expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(2)
            } finally {
                mockAccounts.push(
                    {
                        id: '1',
                        name: 'Account 1',
                        custody: { kind: 'watch' },
                        chains: { algorand: { address: 'ADDR1' } },
                    },
                    {
                        id: '2',
                        name: 'Account 2',
                        custody: { kind: 'watch' },
                        chains: { algorand: { address: 'ADDR2' } },
                    },
                )
            }
        })

        it('skips a switched-off chain while Algorand syncs, and force-syncs it once back on', async () => {
            addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
            mockSwitchedOff.add('ethereum')

            service.start()
            await vi.advanceTimersByTimeAsync(50)
            expect(await accountReadsOn(ETHEREUM)).toEqual([])
            expect(await accountReadsOn(MAINNET)).toEqual(['ADDR1', 'ADDR2'])

            mockSwitchedOff.delete('ethereum')
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
            service.stop()

            expect(await accountReadsOn(ETHEREUM)).toEqual(['0xabc'])
            expect(ethereumSignal).not.toHaveBeenCalled()
        })

        it('skips an account entry on a chain this build does not register', async () => {
            delete mockAdapters.ethereum
            addEthereumAccount('eth', { ethereum: { address: '0xabc' } })

            service.start()
            await vi.advanceTimersByTimeAsync(50)
            service.stop()

            expect(await accountReadsOn(ETHEREUM)).toEqual([])
            expect(await accountReadsOn(MAINNET)).toEqual(['ADDR1', 'ADDR2'])
        })

        it("stops one scope's refused signal without stopping the others", async () => {
            addEthereumAccount('eth', { ethereum: { address: '0xabc' } })
            const { useSyncCursorStore } = await import('../polling')
            const original = useSyncCursorStore.getState
            useSyncCursorStore.getState = () =>
                cursorState({ 'algorand/mainnet': 100 }) as never
            mockSendShouldRefreshRequest.mockRejectedValue(
                peraNetworkError(401),
            )

            try {
                service.start()
                await vi.advanceTimersByTimeAsync(50)
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)
                expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)

                mockSendShouldRefreshRequest.mockClear()
                ethereumSignal.mockClear()
                await vi.advanceTimersByTimeAsync(POLL_INTERVAL)

                expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
                expect(ethereumSignal).toHaveBeenCalledTimes(1)
            } finally {
                useSyncCursorStore.getState = original
                service.stop()
            }
        })

        it('invalidates only the chain that settled', async () => {
            const {
                invalidateTransactionQueries,
                invalidateTransactionQueriesForChain,
            } = await import('@perawallet/wallet-core-transactions')
            mockChainList = [{ id: 'algorand' }, { id: 'ethereum' }]
            mockBroadcasters.add('ethereum')
            mockReconcileOpenSubmissions.mockImplementation(
                async (chainId: string) => ({
                    probed: 1,
                    confirmed: chainId === 'ethereum' ? 1 : 0,
                    failed: 0,
                }),
            )

            service.start()
            await flushMicrotasks()
            service.stop()

            expect(invalidateTransactionQueriesForChain).toHaveBeenCalledTimes(
                1,
            )
            expect(invalidateTransactionQueriesForChain).toHaveBeenCalledWith(
                queryClient,
                'ethereum',
            )
            expect(invalidateTransactionQueries).not.toHaveBeenCalled()
        })

        it('invalidates a failed settle on its own chain too', async () => {
            const { invalidateTransactionQueriesForChain } =
                await import('@perawallet/wallet-core-transactions')
            mockReconcileOpenSubmissions.mockResolvedValue({
                probed: 1,
                confirmed: 0,
                failed: 1,
            })

            service.start()
            await flushMicrotasks()
            service.stop()

            expect(invalidateTransactionQueriesForChain).toHaveBeenCalledWith(
                queryClient,
                'algorand',
            )
        })

        it('settles open submissions of every broadcasting chain, even with no accounts', async () => {
            mockAccounts.splice(0)

            try {
                service.start()
                await vi.advanceTimersByTimeAsync(50)
                service.stop()

                expect(mockReconcileOpenSubmissions).toHaveBeenCalledTimes(1)
                expect(mockReconcileOpenSubmissions).toHaveBeenCalledWith(
                    'algorand',
                )
            } finally {
                mockAccounts.push(
                    {
                        id: '1',
                        name: 'Account 1',
                        custody: { kind: 'watch' },
                        chains: { algorand: { address: 'ADDR1' } },
                    },
                    {
                        id: '2',
                        name: 'Account 2',
                        custody: { kind: 'watch' },
                        chains: { algorand: { address: 'ADDR2' } },
                    },
                )
            }
        })
    })
})
