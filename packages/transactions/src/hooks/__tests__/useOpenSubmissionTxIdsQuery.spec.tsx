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

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOpenSubmissionTxIdsQuery } from '../useOpenSubmissionTxIdsQuery'

const mockGetOpenSubmissionAttempts = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    getOpenSubmissionAttempts: (...args: unknown[]) =>
        mockGetOpenSubmissionAttempts(...args),
}))

const wrapper =
    (queryClient: QueryClient) =>
    ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )

describe('useOpenSubmissionTxIdsQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        mockGetOpenSubmissionAttempts.mockReset()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    it('returns the txids of open submission attempts for the network', async () => {
        mockGetOpenSubmissionAttempts.mockResolvedValue([
            { txIds: ['TX-A', 'TX-B'] },
            { txIds: ['TX-C'] },
        ])

        const { result } = renderHook(
            () => useOpenSubmissionTxIdsQuery({ network: 'mainnet' }),
            { wrapper: wrapper(queryClient) },
        )

        await waitFor(() =>
            expect([...result.current.openTxIds]).toEqual([
                'TX-A',
                'TX-B',
                'TX-C',
            ]),
        )
        expect(mockGetOpenSubmissionAttempts).toHaveBeenCalledWith({
            network: 'mainnet',
        })
    })

    it('defaults to an empty set while the query is pending or failing', async () => {
        mockGetOpenSubmissionAttempts.mockResolvedValue([])

        const { result } = renderHook(
            () => useOpenSubmissionTxIdsQuery({ network: 'testnet' }),
            { wrapper: wrapper(queryClient) },
        )

        expect([...result.current.openTxIds]).toEqual([])
        await waitFor(() =>
            expect(mockGetOpenSubmissionAttempts).toHaveBeenCalled(),
        )
        expect([...result.current.openTxIds]).toEqual([])
    })

    it('keeps the empty set identity stable across re-renders', async () => {
        mockGetOpenSubmissionAttempts.mockReturnValue(new Promise(() => {}))

        const { result, rerender } = renderHook(
            () => useOpenSubmissionTxIdsQuery({ network: 'mainnet' }),
            { wrapper: wrapper(queryClient) },
        )

        const first = result.current.openTxIds
        rerender()
        // Every transaction row subscribes to this hook; a fresh Set per
        // render re-renders the whole list on any unrelated state change.
        expect(result.current.openTxIds).toBe(first)
    })
})
