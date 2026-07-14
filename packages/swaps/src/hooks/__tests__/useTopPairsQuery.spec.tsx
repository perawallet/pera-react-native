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
import React from 'react'
import { useTopPairsQuery } from '../useTopPairsQuery'
import { fetchTopPairs } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../api', () => ({
    fetchTopPairs: vi.fn(),
}))

const mockTopPair = {
    assetA: { assetId: 0, verificationTier: 'verified' as const },
    assetB: { assetId: 31566704, verificationTier: 'verified' as const },
    volume24hUsd: '1000000.00',
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

describe('swaps/useTopPairsQuery', () => {
    beforeEach(() => {
        vi.mocked(fetchTopPairs).mockResolvedValue([mockTopPair])
    })

    test('returns top pairs on success', async () => {
        const { result } = renderHook(() => useTopPairsQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isFetched).toBe(true))

        expect(result.current.data).toEqual([mockTopPair])
        expect(result.current.isError).toBe(false)
    })

    test('passes limit to fetchTopPairs', async () => {
        const { result } = renderHook(() => useTopPairsQuery(3), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isFetched).toBe(true))

        expect(fetchTopPairs).toHaveBeenCalledWith('mainnet', 3)
    })

    test('sets isError on failure', async () => {
        vi.mocked(fetchTopPairs).mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useTopPairsQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.data).toBeUndefined()
        expect(result.current.error).toBeInstanceOf(Error)
    })
})
