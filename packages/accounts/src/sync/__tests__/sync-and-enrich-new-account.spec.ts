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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { QueryClient } from '@tanstack/react-query'
import { syncAndEnrichNewAccount } from '../account-syncer'
import {
    fakeAccountsChain,
    MAINNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

const fetchAccountState = () =>
    vi.mocked(fakeAccountsChain().adapter.fetchAccountState)

const mockFetchAndPersistAssets = vi.fn(() => Promise.resolve())
const mockFetchAndPersistPrices = vi.fn(() => Promise.resolve())

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchAndPersistAssets: (...args: unknown[]) =>
        mockFetchAndPersistAssets(...args),
    fetchAndPersistPrices: (...args: unknown[]) =>
        mockFetchAndPersistPrices(...args),
}))

const mockUpsertAccountBalance = vi.fn()
const mockRefreshAccountHoldings = vi.fn()
const mockGetAccountBalance = vi.fn()
const mockGetAccountHoldings = vi.fn()

vi.mock('../../db', () => ({
    upsertAccountBalance: (...args: unknown[]) =>
        mockUpsertAccountBalance(...args),
    refreshAccountHoldings: (...args: unknown[]) =>
        mockRefreshAccountHoldings(...args),
    getAccountBalance: (...args: unknown[]) => mockGetAccountBalance(...args),
    getAccountHoldings: (...args: unknown[]) => mockGetAccountHoldings(...args),
}))

const makeQueryClient = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    return { queryClient, invalidateSpy }
}

describe('syncAndEnrichNewAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUpsertAccountBalance.mockResolvedValue(undefined)
        mockRefreshAccountHoldings.mockResolvedValue(true)
        mockGetAccountBalance.mockResolvedValue(undefined)
        fetchAccountState().mockResolvedValue({
            nativeBalance: new Decimal(1),
            minBalance: new Decimal('0.1'),
            totalAssetsOptedIn: 1,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            status: 'Offline',
            authAddress: null,
            holdings: [
                {
                    assetId: '0',
                    amount: new Decimal(1_000_000),
                    isFrozen: false,
                },
                { assetId: '100', amount: new Decimal(5), isFrozen: false },
            ],
            observedRound: null,
        })
        mockGetAccountHoldings.mockResolvedValue([
            { assetId: '0', amount: new Decimal(1_000_000) },
            { assetId: '100', amount: new Decimal(5) },
        ])
    })

    it('fetches the account, then enriches held assets with metadata + prices, invalidating after each phase', async () => {
        const { queryClient, invalidateSpy } = makeQueryClient()

        await syncAndEnrichNewAccount('ADDR1', 'mainnet', queryClient)

        expect(fetchAccountState()).toHaveBeenCalledWith(
            'ADDR1',
            MAINNET_SCOPE,
            {
                priorResourceCount: 0,
            },
        )
        expect(mockFetchAndPersistAssets).toHaveBeenCalledWith(['0', '100'], {
            chainId: 'algorand',
            networkId: 'mainnet',
        })
        expect(mockFetchAndPersistPrices).toHaveBeenCalledWith(
            ['0', '100'],
            'mainnet',
        )
        // Once after the account fetch, once after enrichment.
        expect(invalidateSpy).toHaveBeenCalledTimes(2)
    })

    it('skips enrichment when the account has no holdings', async () => {
        const { queryClient, invalidateSpy } = makeQueryClient()
        mockGetAccountHoldings.mockResolvedValue([])

        await syncAndEnrichNewAccount('ADDR1', 'mainnet', queryClient)

        expect(mockFetchAndPersistAssets).not.toHaveBeenCalled()
        expect(mockFetchAndPersistPrices).not.toHaveBeenCalled()
        expect(invalidateSpy).toHaveBeenCalledTimes(1)
    })

    it('swallows fetch errors (never throws to the caller)', async () => {
        const { queryClient, invalidateSpy } = makeQueryClient()
        fetchAccountState().mockRejectedValue(new Error('algod down'))

        await expect(
            syncAndEnrichNewAccount('ADDR1', 'mainnet', queryClient),
        ).resolves.toBeUndefined()

        expect(mockFetchAndPersistAssets).not.toHaveBeenCalled()
        expect(invalidateSpy).not.toHaveBeenCalled()
    })
})
