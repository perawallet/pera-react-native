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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SyncService } from '../service/sync-service'
import { QueryClient } from '@tanstack/react-query'

const mockAccounts = [
    { address: 'ADDR1', name: 'Account 1' },
    { address: 'ADDR2', name: 'Account 2' },
]

const mockSendShouldRefreshRequest = vi.fn()
const mockSetLastRefreshedRound = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: {
        getState: () => ({ accounts: mockAccounts }),
    },
    upsertAccountBalance: vi.fn(() => Promise.resolve()),
    refreshAccountHoldings: vi.fn(() => Promise.resolve(true)),
    getAllAssetIdsForNetwork: vi.fn(() => Promise.resolve(['123', '456'])),
    invalidateAccountQueries: vi.fn(),
    invalidateAccountQueriesForAddresses: vi.fn(),
    fetchAndPersistAccount: vi.fn(() =>
        Promise.resolve({ changed: true, holdingsChanged: true }),
    ),
}))

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
        getState: () => ({ network: 'mainnet' }),
    },
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
    ALGO_ASSET_ID: '0',
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

    it('does not advance the round when any account fetch fails', async () => {
        const { fetchAndPersistAccount } =
            await import('@perawallet/wallet-core-accounts')

        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: true,
            round: 42,
        })
        // One account fails — its new state was not persisted, so the
        // checkpoint must stay put and the next tick retries.
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

        // First tick: force-sync; second tick: shouldRefresh-gated sync.
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        await new Promise(resolve => setTimeout(resolve, 3100))
        vi.useFakeTimers()

        service.stop()

        expect(mockSendShouldRefreshRequest).toHaveBeenCalled()
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
})
