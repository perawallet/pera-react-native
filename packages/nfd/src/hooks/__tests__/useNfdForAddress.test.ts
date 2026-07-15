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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockEnqueue = vi.hoisted(() => vi.fn())

vi.mock('../../services/nfdBatchQueue', () => ({
    nfdBatchQueue: { enqueue: mockEnqueue },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
    isValidAlgorandAddress: (address?: string) =>
        !!address && /^[0-9a-zA-Z]{58}$/.test(address),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        reactQueryLongLivedStaleTime: 7 * 24 * 60 * 60 * 1000,
        reactQueryLongLivedGCTime: 21 * 24 * 60 * 60 * 1000,
    },
}))

import { useNfdForAddressQuery } from '../useNfdForAddressQuery'

const VALID_ADDRESS = 'A'.repeat(58)

describe('useNfdForAddressQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        mockEnqueue.mockReset().mockResolvedValue(undefined)
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('returns the NFD name resolved by the batch queue', async () => {
        mockEnqueue.mockResolvedValue({
            name: 'alice.algo',
            image: '',
            source: 'nfd',
        })

        const { result } = renderHook(
            () => useNfdForAddressQuery(VALID_ADDRESS),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.data?.at(0)?.name).toBe('alice.algo'),
        )
        expect(mockEnqueue).toHaveBeenCalledTimes(1)
        expect(mockEnqueue).toHaveBeenCalledWith(VALID_ADDRESS, 'mainnet')
    })

    it('returns empty array when the queue resolves with null (negative cache)', async () => {
        mockEnqueue.mockResolvedValue(null)

        const { result } = renderHook(
            () => useNfdForAddressQuery(VALID_ADDRESS),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toEqual([])
    })

    it('returns empty array when the queue resolves with undefined', async () => {
        mockEnqueue.mockResolvedValue(undefined)

        const { result } = renderHook(
            () => useNfdForAddressQuery(VALID_ADDRESS),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toEqual([])
    })

    it('calls enqueue synchronously inside queryFn (no awaits before it)', async () => {
        // This is the regression guard for the batching bug: if the hook
        // ever introduces an `await` before `enqueue`, microtask flushes
        // can fire between concurrent rows and the queue stops batching.
        // We assert by mounting two hooks and checking that BOTH
        // enqueue calls happen before either resolves.
        let resolveFirst!: (v: unknown) => void
        const firstPromise = new Promise(resolve => {
            resolveFirst = resolve
        })
        mockEnqueue
            .mockImplementationOnce(() => firstPromise)
            .mockImplementationOnce(() =>
                Promise.resolve({ name: 'bob.algo', image: '', source: 'nfd' }),
            )

        const ADDR_1 = 'A'.repeat(58)
        const ADDR_2 = 'B'.repeat(58)

        renderHook(() => useNfdForAddressQuery(ADDR_1), { wrapper })
        renderHook(() => useNfdForAddressQuery(ADDR_2), { wrapper })

        // Both should have enqueued before either resolves (no await gating)
        await waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(2))

        resolveFirst({ name: 'alice.algo', image: '', source: 'nfd' })
    })

    it('does not query when enabled is false', () => {
        renderHook(
            () => useNfdForAddressQuery(VALID_ADDRESS, { enabled: false }),
            { wrapper },
        )
        expect(mockEnqueue).not.toHaveBeenCalled()
    })

    it('does not query for invalid addresses', () => {
        renderHook(() => useNfdForAddressQuery('not-an-address'), { wrapper })
        expect(mockEnqueue).not.toHaveBeenCalled()
    })
})
