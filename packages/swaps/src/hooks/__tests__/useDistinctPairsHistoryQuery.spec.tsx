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

// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useDistinctPairsHistoryQuery } from '../useDistinctPairsHistoryQuery'
import { fetchSwapHistory } from '../../api'
import { makeSwapHistoryItem } from '../../__tests__/swapHistoryFixture'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<typeof import('../../api')>()),
    fetchSwapHistory: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceIdLookup: () => () => 'device-1',
}))

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
        vi.mocked(fetchSwapHistory).mockReset()
    })

    test('derives the distinct pairs from the newest history page', async () => {
        vi.mocked(fetchSwapHistory).mockResolvedValue({
            results: [
                makeSwapHistoryItem({ orderId: 'a' }),
                makeSwapHistoryItem({ orderId: 'b' }),
                makeSwapHistoryItem({ orderId: 'c', status: 'failed' }),
            ],
            next: 'more',
        })

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery('ADDRESS', SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isFetched).toBe(true))
        expect(fetchSwapHistory).toHaveBeenCalledWith(
            {
                deviceId: 'device-1',
                accounts: ['fake-a:main:ADDRESS'],
                limit: 50,
            },
            SCOPE,
        )
        expect(result.current.data).toHaveLength(1)
        expect(result.current.data?.[0].pairKey).toBe(
            'algorand/native|algorand/31566704',
        )
    })

    test('leaves out orders the wallet did not fund itself', async () => {
        vi.mocked(fetchSwapHistory).mockResolvedValue({
            results: [
                makeSwapHistoryItem({ orderId: 'a', fundingMethod: 'deposit' }),
            ],
            next: null,
        })

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery('ADDRESS', SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isFetched).toBe(true))
        expect(result.current.data).toEqual([])
    })

    test('is disabled without an address', () => {
        renderHook(() => useDistinctPairsHistoryQuery('', SCOPE), {
            wrapper: createWrapper(),
        })

        expect(fetchSwapHistory).not.toHaveBeenCalled()
    })

    test('sets isError on failure', async () => {
        vi.mocked(fetchSwapHistory).mockRejectedValue(new Error('boom'))

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery('ADDRESS', SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
