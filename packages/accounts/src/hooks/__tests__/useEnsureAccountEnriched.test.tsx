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

import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { Decimal } from 'decimal.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEnsureAccountEnriched } from '../useEnsureAccountEnriched'

const mockEnsureAccountFetched = vi.fn(() => Promise.resolve())
const mockGetAccountHoldings = vi.fn()
const mockFetchAndPersistAssets = vi.fn(() => Promise.resolve())
const mockFetchAndPersistPrices = vi.fn(() => Promise.resolve())

vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: (...a: unknown[]) => mockEnsureAccountFetched(...a),
}))
vi.mock('../../db', () => ({
    getAccountHoldings: (...a: unknown[]) => mockGetAccountHoldings(...a),
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))
vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchAndPersistAssets: (...a: unknown[]) => mockFetchAndPersistAssets(...a),
    fetchAndPersistPrices: (...a: unknown[]) => mockFetchAndPersistPrices(...a),
}))
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }
})

const makeWrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
    return { wrapper, invalidateSpy }
}

describe('useEnsureAccountEnriched', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetAccountHoldings.mockResolvedValue([
            { assetId: '0', amount: new Decimal(1) },
            { assetId: '100', amount: new Decimal(2) },
        ])
    })

    it('fetches holdings, then asset metadata + prices, invalidating along the way', async () => {
        const { wrapper, invalidateSpy } = makeWrapper()
        renderHook(() => useEnsureAccountEnriched('ADDR1'), { wrapper })

        await waitFor(() =>
            expect(mockFetchAndPersistAssets).toHaveBeenCalled(),
        )

        expect(mockEnsureAccountFetched).toHaveBeenCalledWith(
            'ADDR1',
            'mainnet',
        )
        expect(mockFetchAndPersistAssets).toHaveBeenCalledWith(
            ['0', '100'],
            'mainnet',
        )
        expect(mockFetchAndPersistPrices).toHaveBeenCalledWith(
            ['0', '100'],
            'mainnet',
        )
        await waitFor(() => expect(invalidateSpy).toHaveBeenCalled())
    })

    it('does nothing without an address', () => {
        const { wrapper } = makeWrapper()
        renderHook(() => useEnsureAccountEnriched(undefined), { wrapper })
        expect(mockEnsureAccountFetched).not.toHaveBeenCalled()
    })
})
