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

const mockAccounts = [
    { address: 'ADDR1', name: 'Account 1' },
    { address: 'ADDR2', name: 'Account 2' },
]

// Mirrors the private constants in sync-service.ts.
const POLL_INTERVAL = 3000
const MAX_BACKOFF_INTERVAL = 30_000

const mockSendShouldRefreshRequest = vi.fn()
const mockSetLastRefreshedRound = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: {
        getState: () => ({ accounts: mockAccounts }),
    },
    upsertAccountBalance: vi.fn(() => Promise.resolve()),
    refreshAccountHoldings: vi.fn(() => Promise.resolve(true)),
    getAllHeldAssetIdsForNetwork: vi.fn(() => Promise.resolve(['123', '456'])),
    invalidateAccountQueries: vi.fn(),
    invalidateAccountQueriesForAddresses: vi.fn(),
    fetchAndPersistAccount: vi.fn(() =>
        Promise.resolve({ changed: true, holdingsChanged: true }),
    ),
}))

// Mutable so a test can switch the active network to 'custom' without
// re-mocking the whole module — reset in beforeEach to avoid cross-test leakage.
let mockNetwork = 'mainnet'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    getAlgorandClient: () => ({
        account: {
            getInformation: vi.fn(() =>
                Promise.resolve({
                    balance: { microAlgos: 1000000n },
                    minBalance: { microAlgos: 100000n },
                    status: 'Online',
                    assets: [{ assetId: 123, amount: 100 }],
                    totalAssetsOptedIn: 1,
                    totalCreatedAssets: 0,
                    totalAppsOptedIn: 0,
                    authAddr: undefined,
                }),
            ),
        },
    }),
    useNetworkStore: {
        getState: () => ({ network: mockNetwork }),
    },
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    isPeraBackedNetwork: (n: string) => n === 'mainnet' || n === 'testnet',
}))

vi.mock('@perawallet/wallet-core-polling', () => ({
    sendShouldRefreshRequest: (...args: unknown[]) =>
        mockSendShouldRefreshRequest(...args),
    usePollingStore: {
        getState: () => ({
            lastRefreshedRound: { mainnet: null, testnet: null },
            setLastRefreshedRound: mockSetLastRefreshedRound,
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
    invalidateAssetQueries: vi.fn(),
    fetchAndPersistAssets: vi.fn(() => Promise.resolve()),
    fetchAndPersistPrices: vi.fn(() => Promise.resolve()),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    fetchTransactionHistory: vi.fn(() =>
        Promise.resolve({
            transactions: [],
            pagination: { nextUrl: null },
            currentRound: 0,
        }),
    ),
    getLatestTransactionRoundTime: vi.fn(() => Promise.resolve(null)),
    upsertTransactions: vi.fn(() => Promise.resolve()),
    invalidateTransactionQueries: vi.fn(),
    fetchAndPersistTransactions: vi.fn(() => Promise.resolve()),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
    Networks: { mainnet: 'mainnet', testnet: 'testnet' },
    partition: (arr: unknown[], size: number) => {
        const result = []
        for (let i = 0; i < arr.length; i += size) {
            result.push((arr as unknown[]).slice(i, i + size))
        }
        return result
    },
    calculateBackoff: (current: number, multiplier: number, max: number) =>
        Math.min(current * multiplier, max),
}))

describe('SyncService', () => {
    let queryClient: QueryClient
    let service: SyncService

    beforeEach(async () => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        mockNetwork = 'mainnet'
        // A couple of tests reassign useNetworkStore.getState directly (to a
        // closure that doesn't read mockNetwork) and restore it to a
        // hardcoded 'mainnet' closure in their finally block — reset it back
        // to the mockNetwork-driven implementation here so this test's
        // behavior does not depend on suite execution order.
        const { useNetworkStore } =
            await import('@perawallet/wallet-core-blockchain')
        useNetworkStore.getState = () => ({ network: mockNetwork })
        queryClient = new QueryClient()
        service = new SyncService({ queryClient })

        // Re-establish default success implementations. clearAllMocks() clears
        // call history but not implementations set by individual tests, so reset
        // them here to keep the change-gated sync behavior consistent.
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')
        const { fetchAndPersistAssets, fetchAndPersistPrices } =
            await import('@perawallet/wallet-core-assets')
        const { fetchAndPersistTransactions } =
            await import('@perawallet/wallet-core-transactions')
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
    })

    afterEach(() => {
        service.stop()
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

    it('force-syncs all networks on the first tick', async () => {
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        service.start()

        // First tick runs immediately — should NOT call shouldRefresh
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        vi.useFakeTimers()

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()

        service.stop()
    })

    it('calls shouldRefresh for the active network on subsequent ticks', async () => {
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        vi.useRealTimers()

        service.start()

        // First tick: force-sync (skip shouldRefresh)
        await new Promise(resolve => setTimeout(resolve, 50))

        // Second tick: uses shouldRefresh (after POLL_INTERVAL = 3000ms)
        await new Promise(resolve => setTimeout(resolve, 3100))

        service.stop()
        vi.useFakeTimers()

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
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        vi.useFakeTimers()

        // Second tick: uses shouldRefresh
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 3050))
        vi.useFakeTimers()

        service.stop()

        expect(mockSetLastRefreshedRound).toHaveBeenCalledWith('mainnet', 42)
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
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        await new Promise(resolve => setTimeout(resolve, 6200))
        vi.useFakeTimers()

        service.stop()

        expect(mockSendShouldRefreshRequest).toHaveBeenCalled()
        expect(mockSetLastRefreshedRound).not.toHaveBeenCalled()
    }, 10_000)

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

        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        await new Promise(resolve => setTimeout(resolve, 3100))
        vi.useFakeTimers()

        service.stop()

        expect(mockSetLastRefreshedRound).not.toHaveBeenCalled()
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

        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        mockSetLastRefreshedRound.mockClear()
        await new Promise(resolve => setTimeout(resolve, 3100))
        vi.useFakeTimers()

        service.stop()

        expect(mockSetLastRefreshedRound).toHaveBeenCalledWith('mainnet', 99)
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
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        vi.useFakeTimers()

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
        expect(fetchAndPersistAccount).toHaveBeenCalled()

        vi.mocked(fetchAndPersistAccount).mockClear()
        mockSendShouldRefreshRequest.mockClear()

        // Restart — should force-sync again (hasCompletedInitialSync reset)
        service.restart()
        expect(service.isRunning()).toBe(true)

        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        vi.useFakeTimers()

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
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        vi.useFakeTimers()

        expect(logger.warn).toHaveBeenCalledWith(
            'Sync step failed',
            expect.objectContaining({
                phase: 'account',
                network: 'mainnet',
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
        const { usePollingStore } =
            await import('@perawallet/wallet-core-polling')

        // Pretend we already completed the initial force-sync so the next
        // tick goes through checkShouldRefresh. lastRefreshedRound must be
        // null so `neverSynced` is true when shouldRefresh throws.
        vi.mocked(usePollingStore.getState).mockReturnValueOnce?.({
            lastRefreshedRound: { mainnet: null, testnet: null },
            setLastRefreshedRound: mockSetLastRefreshedRound,
        } as never)

        service.start()
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        await new Promise(resolve => setTimeout(resolve, 3100))
        service.stop()
        vi.useFakeTimers()

        // neverSynced + shouldRefresh throw => force-sync the active network
        expect(mockSendShouldRefreshRequest).toHaveBeenCalled()
        expect(fetchAndPersistAccount).toHaveBeenCalled()
    })

    // 3 real-timer waits (50 + 3100 + 3100ms) exceed vitest's 5000ms default.
    it('backs off should-refresh after a 401 and skips subsequent requests', async () => {
        const authError = Object.assign(new Error('Unauthorized'), {
            name: 'HTTPError',
            response: { status: 401 },
        })
        mockSendShouldRefreshRequest.mockRejectedValue(authError)
        const { logger } = await import('@perawallet/wallet-core-shared')

        service.start()
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50)) // 1st tick: force-sync
        await new Promise(resolve => setTimeout(resolve, 3100)) // 2nd tick: should-refresh -> 401

        expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('BACKEND_API_KEY'),
            expect.objectContaining({ status: 401 }),
        )

        mockSendShouldRefreshRequest.mockClear()
        await new Promise(resolve => setTimeout(resolve, 3100)) // 3rd tick: guarded, no request

        service.stop()
        vi.useFakeTimers()

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
    }, 8000)

    it('treats 403 the same as 401 for the auth backoff', async () => {
        const authError = Object.assign(new Error('Forbidden'), {
            name: 'HTTPError',
            response: { status: 403 },
        })
        mockSendShouldRefreshRequest.mockRejectedValue(authError)

        service.start()
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        await new Promise(resolve => setTimeout(resolve, 3100))

        mockSendShouldRefreshRequest.mockClear()
        await new Promise(resolve => setTimeout(resolve, 3100))

        service.stop()
        vi.useFakeTimers()

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
    }, 8000)

    it('resets the auth-failure flag on restart so a reconfigured session recovers', async () => {
        const authError = Object.assign(new Error('Unauthorized'), {
            name: 'HTTPError',
            response: { status: 401 },
        })
        mockSendShouldRefreshRequest.mockRejectedValue(authError)

        service.start()
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        await new Promise(resolve => setTimeout(resolve, 3100))

        expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)

        mockSendShouldRefreshRequest.mockClear()
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })
        service.restart()

        await new Promise(resolve => setTimeout(resolve, 50)) // restart force-syncs first
        await new Promise(resolve => setTimeout(resolve, 3100)) // then should-refresh resumes

        service.stop()
        vi.useFakeTimers()

        expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)
    }, 8000)

    it('still force-syncs a never-synced network through the auth backoff, on that tick and subsequent ticks', async () => {
        // lastRefreshedRound stays null throughout (default mock) so the
        // network is never-synced on every tick — algod/indexer use
        // separate credentials from the backend key, so a 401 there must
        // not block the force-sync fallback.
        const authError = Object.assign(new Error('Unauthorized'), {
            name: 'HTTPError',
            response: { status: 401 },
        })
        mockSendShouldRefreshRequest.mockRejectedValue(authError)
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')

        service.start()
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50)) // 1st tick: force-sync (initial)

        vi.mocked(fetchAndPersistAccount).mockClear()
        await new Promise(resolve => setTimeout(resolve, 3100)) // 2nd tick: should-refresh -> 401, but never-synced still force-syncs

        expect(mockSendShouldRefreshRequest).toHaveBeenCalledTimes(1)
        expect(fetchAndPersistAccount).toHaveBeenCalled()

        mockSendShouldRefreshRequest.mockClear()
        vi.mocked(fetchAndPersistAccount).mockClear()
        await new Promise(resolve => setTimeout(resolve, 3100)) // 3rd tick: guarded (no request), never-synced force-sync still fires

        service.stop()
        vi.useFakeTimers()

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
        expect(fetchAndPersistAccount).toHaveBeenCalled()
    }, 8000)

    it('once synced, does not re-issue the should-refresh request or re-log the warning', async () => {
        const authError = Object.assign(new Error('Unauthorized'), {
            name: 'HTTPError',
            response: { status: 401 },
        })
        mockSendShouldRefreshRequest.mockRejectedValue(authError)
        const { logger } = await import('@perawallet/wallet-core-shared')
        const { usePollingStore } =
            await import('@perawallet/wallet-core-polling')
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')

        service.start()
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50)) // 1st tick: force-sync
        await new Promise(resolve => setTimeout(resolve, 3100)) // 2nd tick: should-refresh -> 401, flag set

        expect(logger.warn).toHaveBeenCalledTimes(1)

        // Simulate the network becoming synced (lastRefreshedRound no longer null).
        usePollingStore.getState = vi.fn(() => ({
            lastRefreshedRound: { mainnet: 100, testnet: null },
            setLastRefreshedRound: mockSetLastRefreshedRound,
        }))
        vi.mocked(logger.warn).mockClear()
        mockSendShouldRefreshRequest.mockClear()
        vi.mocked(fetchAndPersistAccount).mockClear()

        await new Promise(resolve => setTimeout(resolve, 3100)) // 3rd tick: now synced — guarded, no fallback

        service.stop()
        vi.useFakeTimers()

        expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
        expect(fetchAndPersistAccount).not.toHaveBeenCalled()
    }, 8000)

    it('force-syncs a network absent from the persisted round map, sending null (not undefined) for its last-refreshed round', async () => {
        const { useNetworkStore } =
            await import('@perawallet/wallet-core-blockchain')
        const { usePollingStore } =
            await import('@perawallet/wallet-core-polling')
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')

        // Exercise the `?? null` semantics on a Pera-backed network (so this
        // tick still reaches sendShouldRefreshRequest — see the
        // "Pera-backed network gating" tests for the non-backed case, e.g.
        // betanet/custom, which now short-circuit before this request
        // entirely and so can no longer demonstrate the wire-payload
        // assertion below). testnet's key is absent here to simulate a
        // partially-seeded persisted map, mirroring how packages/polling's
        // store can have a network key genuinely absent rather than an
        // explicit null.
        useNetworkStore.getState = vi.fn(() => ({ network: 'testnet' }))
        usePollingStore.getState = vi.fn(() => ({
            lastRefreshedRound: { mainnet: 100 },
            setLastRefreshedRound: mockSetLastRefreshedRound,
        }))
        // Backend says "no work needed" — if the absent key were wrongly read
        // as already-synced (undefined !== null), this response alone would
        // skip the force-sync and reproduce the silent bug.
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        try {
            service.start()
            vi.useRealTimers()
            await new Promise(resolve => setTimeout(resolve, 50)) // 1st tick: unconditional force-sync
            vi.mocked(fetchAndPersistAccount).mockClear()
            mockSendShouldRefreshRequest.mockClear()

            await new Promise(resolve => setTimeout(resolve, 3100)) // 2nd tick: checkShouldRefresh path

            service.stop()
            vi.useFakeTimers()

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
            useNetworkStore.getState = () => ({ network: 'mainnet' })
            usePollingStore.getState = () => ({
                lastRefreshedRound: { mainnet: null, testnet: null },
                setLastRefreshedRound: mockSetLastRefreshedRound,
            })
        }
    }, 8000)

    it('rate-limited failures trigger backoff on the next tick', async () => {
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')
        const { logger } = await import('@perawallet/wallet-core-shared')

        vi.mocked(fetchAndPersistAccount).mockRejectedValue(
            new Error('HTTP 429 Too Many Requests'),
        )

        service.start()
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        vi.useFakeTimers()
        service.stop()

        // 429 is filtered from logFailures, so no per-account warn
        expect(logger.warn).toHaveBeenCalledWith(
            'Sync tick failed',
            expect.objectContaining({
                error: expect.objectContaining({
                    message: expect.stringContaining('Rate limited'),
                }),
            }),
        )

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

            await service.refreshAccounts([], 'mainnet')

            expect(fetchAndPersistAccount).not.toHaveBeenCalled()
            expect(fetchAndPersistTransactions).not.toHaveBeenCalled()
        })

        it('fetches account info and transactions for each given address', async () => {
            const { fetchAndPersistAccount, invalidateAccountQueries } =
                await import('@perawallet/wallet-core-accounts')
            const {
                fetchAndPersistTransactions,
                invalidateTransactionQueries,
            } = await import('@perawallet/wallet-core-transactions')

            await service.refreshAccounts(['ADDR1', 'ADDR2'], 'testnet')

            expect(fetchAndPersistAccount).toHaveBeenCalledTimes(2)
            expect(fetchAndPersistAccount).toHaveBeenCalledWith(
                'ADDR1',
                'testnet',
            )
            expect(fetchAndPersistAccount).toHaveBeenCalledWith(
                'ADDR2',
                'testnet',
            )
            expect(fetchAndPersistTransactions).toHaveBeenCalledTimes(2)
            expect(fetchAndPersistTransactions).toHaveBeenCalledWith(
                'ADDR1',
                'testnet',
            )
            expect(fetchAndPersistTransactions).toHaveBeenCalledWith(
                'ADDR2',
                'testnet',
            )
            expect(invalidateAccountQueries).toHaveBeenCalledWith(queryClient)
            expect(invalidateTransactionQueries).toHaveBeenCalledWith(
                queryClient,
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
                service.refreshAccounts(['ADDR1', 'ADDR2'], 'mainnet'),
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
            const { fetchAndPersistAccount, invalidateAccountQueries } =
                await import('@perawallet/wallet-core-accounts')
            const { invalidateTransactionQueries } =
                await import('@perawallet/wallet-core-transactions')

            vi.mocked(fetchAndPersistAccount).mockRejectedValueOnce(
                new Error('all fetches fail'),
            )

            await service.refreshAccounts(['ADDR1'], 'mainnet')

            expect(invalidateAccountQueries).toHaveBeenCalledWith(queryClient)
            expect(invalidateTransactionQueries).toHaveBeenCalledWith(
                queryClient,
            )

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
            await service.refreshAccounts(['ADDR1'], 'mainnet')

            expect(getAllHeldAssetIdsForNetwork).toHaveBeenCalledWith({
                network: 'mainnet',
            })
            expect(fetchAndPersistAssets).toHaveBeenCalledWith(
                ['123', '456'],
                'mainnet',
            )
            expect(fetchAndPersistPrices).toHaveBeenCalledWith(
                ['123', '456'],
                'mainnet',
            )
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

            await service.refreshAccounts(['ADDR1'], 'mainnet')

            expect(fetchAndPersistAssets).not.toHaveBeenCalled()
            expect(invalidateAssetQueries).not.toHaveBeenCalled()

            vi.mocked(fetchAndPersistAccount).mockImplementation(() =>
                Promise.resolve({ changed: true, holdingsChanged: true }),
            )
        })

        it('never throws and still invalidates account/tx queries when asset enrichment fails', async () => {
            const { getAllHeldAssetIdsForNetwork, invalidateAccountQueries } =
                await import('@perawallet/wallet-core-accounts')
            const { invalidateTransactionQueries } =
                await import('@perawallet/wallet-core-transactions')

            vi.mocked(getAllHeldAssetIdsForNetwork).mockRejectedValueOnce(
                new Error('db read blew up'),
            )

            await expect(
                service.refreshAccounts(['ADDR1'], 'mainnet'),
            ).resolves.toBeUndefined()

            expect(invalidateAccountQueries).toHaveBeenCalledWith(queryClient)
            expect(invalidateTransactionQueries).toHaveBeenCalledWith(
                queryClient,
            )
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
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        vi.useFakeTimers()
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
            new Error('HTTP 429 Too Many Requests'),
        )

        service.start()
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        vi.useFakeTimers()
        service.stop()

        // No account fetch succeeded, so nothing changed in the DB — eagerly
        // invalidating would force a wide re-read with no new data, so we skip
        // it. (stop() also clears any pending debounced invalidation.)
        expect(invalidateAccountQueriesForAddresses).not.toHaveBeenCalled()
        expect(invalidateAccountQueries).not.toHaveBeenCalled()
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
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        vi.useFakeTimers()
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
        vi.useRealTimers()
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
        await new Promise(resolve => setTimeout(resolve, 400))
        service.stop()
        vi.useFakeTimers()

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
                pollIntervalMs: 12345,
            } as SyncServiceDeps)

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
        const { fetchAndPersistTransactions, invalidateTransactionQueries } =
            await import('@perawallet/wallet-core-transactions')

        vi.mocked(fetchAndPersistTransactions).mockRejectedValue(
            new Error('tx fetch blew up'),
        )

        service.start()
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        vi.useFakeTimers()
        service.stop()

        // When every account's transaction fetch rejects, invalidation
        // would force a re-read from DB with no new data — so we skip it.
        expect(invalidateTransactionQueries).not.toHaveBeenCalled()

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
            const { usePollingStore } =
                await import('@perawallet/wallet-core-polling')

            mockNetwork = 'custom'
            // Already synced (a number, not null) so neverSynced is false —
            // the pre-fix code path reaches sendShouldRefreshRequest here.
            usePollingStore.getState = vi.fn(() => ({
                lastRefreshedRound: {
                    mainnet: null,
                    testnet: null,
                    custom: 100,
                },
                setLastRefreshedRound: mockSetLastRefreshedRound,
            }))
            mockSendShouldRefreshRequest.mockRejectedValue(
                new Error('PeraServiceUnavailableError'),
            )

            try {
                vi.useRealTimers()
                service.start()

                // First tick: unconditional force-sync (skips checkShouldRefresh).
                await new Promise(resolve => setTimeout(resolve, 50))
                vi.mocked(fetchAndPersistAccount).mockClear()

                // Second tick: goes through checkShouldRefresh. The guard must
                // return early so the chain sync still runs on this tick.
                await new Promise(resolve => setTimeout(resolve, 3100))

                service.stop()
                vi.useFakeTimers()

                expect(mockSendShouldRefreshRequest).not.toHaveBeenCalled()
                expect(fetchAndPersistAccount).toHaveBeenCalled()
            } finally {
                usePollingStore.getState = () => ({
                    lastRefreshedRound: { mainnet: null, testnet: null },
                    setLastRefreshedRound: mockSetLastRefreshedRound,
                })
            }
        }, 8000)

        it('control: still calls should-refresh for a Pera-backed network (mainnet)', async () => {
            const { usePollingStore } =
                await import('@perawallet/wallet-core-polling')

            usePollingStore.getState = vi.fn(() => ({
                lastRefreshedRound: { mainnet: 100, testnet: null },
                setLastRefreshedRound: mockSetLastRefreshedRound,
            }))
            mockSendShouldRefreshRequest.mockResolvedValue({
                refresh: false,
                round: null,
            })

            try {
                vi.useRealTimers()
                service.start()

                await new Promise(resolve => setTimeout(resolve, 50))
                await new Promise(resolve => setTimeout(resolve, 3100))

                service.stop()
                vi.useFakeTimers()

                expect(mockSendShouldRefreshRequest).toHaveBeenCalledWith(
                    'mainnet',
                    ['ADDR1', 'ADDR2'],
                    100,
                )
            } finally {
                usePollingStore.getState = () => ({
                    lastRefreshedRound: { mainnet: null, testnet: null },
                    setLastRefreshedRound: mockSetLastRefreshedRound,
                })
            }
        }, 8000)
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
            const { usePollingStore } =
                await import('@perawallet/wallet-core-polling')
            const originalGetState = usePollingStore.getState
            usePollingStore.getState = (() => ({
                lastRefreshedRound: { mainnet: 42, testnet: null },
                setLastRefreshedRound: mockSetLastRefreshedRound,
            })) as typeof usePollingStore.getState

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
            usePollingStore.getState = originalGetState
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
})
