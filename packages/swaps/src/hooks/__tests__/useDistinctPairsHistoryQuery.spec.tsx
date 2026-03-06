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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useDistinctPairsHistoryQuery } from '../useDistinctPairsHistoryQuery'
import { fetchDistinctPairsHistory } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../api', () => ({
    fetchDistinctPairsHistory: vi.fn(),
}))

const mockAsset = { assetId: 0, verificationTier: 'verified' as const }
const mockPairItem = {
    assetIn: mockAsset,
    assetOut: { assetId: 31566704, verificationTier: 'verified' as const },
    swapDatetime: '2024-01-01T00:00:00Z',
    pairKey: '0-31566704',
}

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('swaps/useDistinctPairsHistoryQuery', () => {
    beforeEach(() => {
        vi.mocked(fetchDistinctPairsHistory).mockResolvedValue([mockPairItem])
    })

    test('returns distinct pairs on success', async () => {
        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery('ADDRESS'),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isFetched).toBe(true))

        expect(result.current.data).toEqual([mockPairItem])
        expect(result.current.isError).toBe(false)
    })

    test('starts with empty data while pending', () => {
        vi.mocked(fetchDistinctPairsHistory).mockReturnValue(
            new Promise(() => {}),
        )

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery('ADDRESS'),
            { wrapper: createWrapper() },
        )

        expect(result.current.data).toEqual([])
        expect(result.current.isPending).toBe(true)
    })

    test('sets isError on failure', async () => {
        vi.mocked(fetchDistinctPairsHistory).mockRejectedValue(
            new Error('Network error'),
        )

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery('ADDRESS'),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.data).toEqual([])
        expect(result.current.error).toBeInstanceOf(Error)
    })
})
