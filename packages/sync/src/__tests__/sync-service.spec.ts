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
    upsertAccountHoldings: vi.fn(() => Promise.resolve()),
    getAllAssetIdsForNetwork: vi.fn(() => Promise.resolve(['123', '456'])),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
    },
    getAlgorandClient: () => ({
        account: {
            getInformation: vi.fn(() =>
                Promise.resolve({
                    balance: { microAlgos: 1000000n },
                    assets: [{ assetId: 123, amount: 100 }],
                    totalAssetsOptedIn: 1,
                    totalCreatedAssets: 0,
                    totalAppsOptedIn: 0,
                    authAddr: undefined,
                }),
            ),
        },
    }),
}))

vi.mock('@perawallet/wallet-core-polling', () => ({
    sendShouldRefreshRequest: (...args: unknown[]) =>
        mockSendShouldRefreshRequest(...args),
    usePollingStore: {
        getState: () => ({
            lastRefreshedRound: null,
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
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: vi.fn(), error: vi.fn() },
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

    it('calls shouldRefresh on tick', async () => {
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: false,
            round: null,
        })

        service.start()

        // The first tick runs immediately on start
        await vi.advanceTimersByTimeAsync(0)

        expect(mockSendShouldRefreshRequest).toHaveBeenCalledWith(
            'mainnet',
            ['ADDR1', 'ADDR2'],
            null,
        )
    })

    it('updates last refreshed round when refresh is needed', async () => {
        mockSendShouldRefreshRequest.mockResolvedValue({
            refresh: true,
            round: 42,
        })

        service.start()

        // Wait for the immediate tick's async work to settle
        // Use real timer for microtask resolution
        vi.useRealTimers()
        await new Promise(resolve => setTimeout(resolve, 50))
        vi.useFakeTimers()

        service.stop()

        expect(mockSetLastRefreshedRound).toHaveBeenCalledWith(42)
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
