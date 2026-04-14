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
    refreshAccountHoldings: vi.fn(() => Promise.resolve()),
    getAllAssetIdsForNetwork: vi.fn(() => Promise.resolve(['123', '456'])),
    invalidateAccountQueries: vi.fn(),
    fetchAndPersistAccount: vi.fn(() => Promise.resolve()),
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
    logger: { warn: vi.fn(), error: vi.fn() },
    Networks: { mainnet: 'mainnet', testnet: 'testnet' },
    partition: (arr: unknown[], size: number) => {
        const result = []
        for (let i = 0; i < arr.length; i += size) {
            result.push((arr as unknown[]).slice(i, i + size))
        }
        return result
    },
}))

describe('SyncService', () => {
    let queryClient: QueryClient
    let service: SyncService

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        queryClient = new QueryClient()
        service = new SyncService({ queryClient })
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
})
