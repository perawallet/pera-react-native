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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import React from 'react'
import { useSwapHistoryQuery } from '../useSwapHistoryQuery'
import { fetchSwapHistory } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../api', () => ({
    fetchSwapHistory: vi.fn(),
}))

const mockAsset = { assetId: 0, verificationTier: 'verified' as const }
const mockHistoryItem = {
    id: 1,
    provider: 'tinyman-v2' as const,
    status: 'completed' as const,
    completedDatetime: '2024-01-01T00:00:00Z',
    transactionGroupId: 'abc123',
    assetIn: mockAsset,
    assetOut: mockAsset,
    amountIn: new Decimal('1000000'),
    amountOut: new Decimal('2000000'),
    amountInUsdValue: '1.00',
    amountOutUsdValue: '2.00',
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

describe('swaps/useSwapHistoryQuery', () => {
    beforeEach(() => {
        vi.mocked(fetchSwapHistory).mockResolvedValue({
            results: [mockHistoryItem],
            next: null,
            previous: null,
        })
    })

    test('returns swap history on success', async () => {
        const { result } = renderHook(() => useSwapHistoryQuery('ADDRESS'), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isFetched).toBe(true))

        expect(result.current.data?.results).toEqual([mockHistoryItem])
        expect(result.current.data?.next).toBeNull()
        expect(result.current.isError).toBe(false)
    })

    test('data is undefined while pending', () => {
        vi.mocked(fetchSwapHistory).mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useSwapHistoryQuery('ADDRESS'), {
            wrapper: createWrapper(),
        })

        expect(result.current.data).toBeUndefined()
        expect(result.current.isPending).toBe(true)
    })

    test('sets isError on failure', async () => {
        vi.mocked(fetchSwapHistory).mockRejectedValue(
            new Error('Network error'),
        )

        const { result } = renderHook(() => useSwapHistoryQuery('ADDRESS'), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.data).toBeUndefined()
        expect(result.current.error).toBeInstanceOf(Error)
    })
})
