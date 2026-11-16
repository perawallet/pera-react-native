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
import { createElement, type ReactNode } from 'react'
import { useDiscoverNewsQuery } from '../useDiscoverNewsQuery'
import * as newsEndpoints from '../../api/news/endpoints'

vi.mock('../../api/news/endpoints')
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useWalletDeployment: () => 'live',
}))

const ISO = '2026-11-01T10:00:00Z'

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useDiscoverNewsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('turns publishedAt into a Date after select', async () => {
        vi.mocked(newsEndpoints.fetchDiscoverNews).mockResolvedValue([
            { id: 'n1', title: 'First', banner: null, publishedAt: ISO },
        ])

        const { result } = renderHook(() => useDiscoverNewsQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(newsEndpoints.fetchDiscoverNews).toHaveBeenCalledWith(
            'live',
            expect.anything(),
        )
        const item = result.current.data?.[0]
        expect(item?.publishedAt).toBeInstanceOf(Date)
        expect(item?.publishedAt).toEqual(new Date(ISO))
        expect(item?.title).toBe('First')
    })

    test('keeps the same data reference across a rerender', async () => {
        vi.mocked(newsEndpoints.fetchDiscoverNews).mockResolvedValue([
            { id: 'n1', title: 'First', banner: null, publishedAt: ISO },
        ])

        const { result, rerender } = renderHook(() => useDiscoverNewsQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.data).toBeDefined()
        })
        const first = result.current.data

        rerender()

        expect(result.current.data).toBe(first)
        expect(result.current.data?.[0]).toBe(first?.[0])
    })
})
