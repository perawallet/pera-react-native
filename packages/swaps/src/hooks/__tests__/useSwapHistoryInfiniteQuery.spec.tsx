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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import React from 'react'
import { useSwapHistoryInfiniteQuery } from '../useSwapHistoryInfiniteQuery'
import { fetchSwapHistory } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../api', () => ({
    fetchSwapHistory: vi.fn(),
}))

const mockAsset = { assetId: 0, verificationTier: 'verified' as const }
const makeItem = (id: number) => ({
    id,
    provider: 'tinyman-v2' as const,
    status: 'completed' as const,
    completedDatetime: '2024-01-01T00:00:00Z',
    transactionGroupId: `group-${id}`,
    assetIn: mockAsset,
    assetOut: mockAsset,
    amountIn: new Decimal('1000000'),
    amountOut: new Decimal('2000000'),
    amountInUsdValue: '1.00',
    amountOutUsdValue: '2.00',
})

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

describe('swaps/useSwapHistoryInfiniteQuery', () => {
    beforeEach(() => {
        vi.mocked(fetchSwapHistory).mockReset()
    })

    test('flattens pages into a single swaps array', async () => {
        vi.mocked(fetchSwapHistory).mockResolvedValueOnce({
            results: [makeItem(1), makeItem(2)],
            next: null,
            previous: null,
        })

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery('ADDRESS'),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.swaps).toHaveLength(2)
        expect(result.current.swaps[0].id).toBe(1)
        expect(result.current.hasNextPage).toBe(false)
    })

    test('fetchNextPage passes cursor extracted from the next URL', async () => {
        vi.mocked(fetchSwapHistory)
            .mockResolvedValueOnce({
                results: [makeItem(1)],
                next: 'https://api.example.com/v2/dex-swap/history/?cursor=abc123&limit=20',
                previous: null,
            })
            .mockResolvedValueOnce({
                results: [makeItem(2)],
                next: null,
                previous: null,
            })

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery('ADDRESS'),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.hasNextPage).toBe(true))

        await act(async () => {
            result.current.fetchNextPage()
        })

        await waitFor(() => expect(result.current.swaps).toHaveLength(2))

        const secondCallArgs = vi.mocked(fetchSwapHistory).mock.calls[1]
        expect(secondCallArgs[3]).toBe('abc123')
    })

    test('is disabled when address is empty', () => {
        renderHook(() => useSwapHistoryInfiniteQuery(''), {
            wrapper: createWrapper(),
        })

        expect(fetchSwapHistory).not.toHaveBeenCalled()
    })

    test('sets isError on failure', async () => {
        vi.mocked(fetchSwapHistory).mockRejectedValue(new Error('boom'))

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery('ADDRESS'),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.swaps).toEqual([])
    })
})
