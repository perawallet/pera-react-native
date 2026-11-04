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
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useSwapHistoryInfiniteQuery } from '../useSwapHistoryInfiniteQuery'
import { fetchSwapHistory } from '../../api'
import { makeSwapHistoryItem } from '../../__tests__/swapHistoryFixture'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<typeof import('../../api')>()),
    fetchSwapHistory: vi.fn(),
}))

const mockDeviceId = vi.hoisted(() => ({
    current: 'device-1' as string | null,
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceIdLookup: () => () => mockDeviceId.current,
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

describe('swaps/useSwapHistoryInfiniteQuery', () => {
    beforeEach(() => {
        vi.mocked(fetchSwapHistory).mockReset()
        mockDeviceId.current = 'device-1'
    })

    test('asks for the device and the account on the scope', async () => {
        vi.mocked(fetchSwapHistory).mockResolvedValueOnce({
            results: [makeSwapHistoryItem()],
            next: null,
        })

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery('ADDRESS', SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(fetchSwapHistory).toHaveBeenCalledWith(
            {
                deviceId: 'device-1',
                accounts: ['fake-a:main:ADDRESS'],
                cursor: undefined,
                limit: 20,
            },
            SCOPE,
        )
        expect(result.current.swaps).toHaveLength(1)
        expect(result.current.hasNextPage).toBe(false)
    })

    test('narrows the loaded rows to the statuses asked for', async () => {
        vi.mocked(fetchSwapHistory).mockResolvedValueOnce({
            results: [
                makeSwapHistoryItem({ orderId: 'a', status: 'completed' }),
                makeSwapHistoryItem({ orderId: 'b', status: 'cancelled' }),
                makeSwapHistoryItem({ orderId: 'c', status: 'refunded' }),
            ],
            next: null,
        })

        const { result } = renderHook(
            () =>
                useSwapHistoryInfiniteQuery('ADDRESS', SCOPE, [
                    'completed',
                    'refunded',
                ]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.swaps.map(item => item.orderId)).toEqual([
            'a',
            'c',
        ])
    })

    test('fetchNextPage passes the next cursor', async () => {
        vi.mocked(fetchSwapHistory)
            .mockResolvedValueOnce({
                results: [makeSwapHistoryItem({ orderId: 'a' })],
                next: 'abc123',
            })
            .mockResolvedValueOnce({
                results: [makeSwapHistoryItem({ orderId: 'b' })],
                next: null,
            })

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery('ADDRESS', SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.hasNextPage).toBe(true))
        await act(async () => {
            result.current.fetchNextPage()
        })

        await waitFor(() => expect(result.current.swaps).toHaveLength(2))
        expect(vi.mocked(fetchSwapHistory).mock.calls[1][0].cursor).toBe(
            'abc123',
        )
    })

    test('waits for an address and a device id', () => {
        mockDeviceId.current = null
        renderHook(() => useSwapHistoryInfiniteQuery('ADDRESS', SCOPE), {
            wrapper: createWrapper(),
        })
        renderHook(() => useSwapHistoryInfiniteQuery('', SCOPE), {
            wrapper: createWrapper(),
        })

        expect(fetchSwapHistory).not.toHaveBeenCalled()
    })

    test('sets isError on failure', async () => {
        vi.mocked(fetchSwapHistory).mockRejectedValue(new Error('boom'))

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery('ADDRESS', SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.swaps).toEqual([])
    })
})
