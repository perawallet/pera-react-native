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
import {
    useOpenSubmissionTxIdsQuery,
    invalidateOpenSubmissionTxIdsQuery,
} from '../useOpenSubmissionTxIdsQuery'

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

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect([...result.current.openTxIds]).toEqual(['TX-A', 'TX-B', 'TX-C'])
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
        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect([...result.current.openTxIds]).toEqual([])
    })

    it('invalidateOpenSubmissionTxIdsQuery refetches the open set', async () => {
        mockGetOpenSubmissionAttempts.mockResolvedValue([{ txIds: ['TX-A'] }])

        const { result } = renderHook(
            () => useOpenSubmissionTxIdsQuery({ network: 'mainnet' }),
            { wrapper: wrapper(queryClient) },
        )
        await waitFor(() =>
            expect(result.current.openTxIds.has('TX-A')).toBe(true),
        )

        // A row settled — the next read no longer lists the txid.
        mockGetOpenSubmissionAttempts.mockResolvedValue([])
        invalidateOpenSubmissionTxIdsQuery(queryClient)

        await waitFor(() =>
            expect(result.current.openTxIds.has('TX-A')).toBe(false),
        )
    })
})
