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
import { useNfdSearchQuery } from '../useNfdSearchQuery'

const mockFetchNfdSearch = vi.hoisted(() => vi.fn())

vi.mock('../../api', () => ({
    fetchNfdSearch: mockFetchNfdSearch,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

describe('useNfdSearchQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('lowercases a mixed-case search term before fetching', async () => {
        mockFetchNfdSearch.mockResolvedValue([])

        renderHook(() => useNfdSearchQuery('BruNo.aLgo'), { wrapper })

        await waitFor(() => expect(mockFetchNfdSearch).toHaveBeenCalled())

        expect(mockFetchNfdSearch).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'bruno.algo' }),
        )
    })

    it('does not fetch when disabled', () => {
        renderHook(() => useNfdSearchQuery('BruNo.aLgo', { enabled: false }), {
            wrapper,
        })

        expect(mockFetchNfdSearch).not.toHaveBeenCalled()
    })
})
