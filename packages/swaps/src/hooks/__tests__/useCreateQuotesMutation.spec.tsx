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
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useCreateQuotesMutation } from '../useCreateQuotesMutation'
import { createSwapQuotes } from '../../api'
import { makeSwapQuote } from '../../__tests__/swapQuoteFixture'

vi.mock('../../api', () => ({ createSwapQuotes: vi.fn() }))

const quote = makeSwapQuote()

function createWrapper() {
    const queryClient = new QueryClient()
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('swaps/useCreateQuotesMutation', () => {
    beforeEach(() => {
        vi.mocked(createSwapQuotes).mockResolvedValue([quote])
    })

    test('quotes the request and returns the offers', async () => {
        const { result } = renderHook(() => useCreateQuotesMutation(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.mutate(quote.request)
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(createSwapQuotes).toHaveBeenCalledWith(quote.request)
        expect(result.current.data).toEqual([quote])
    })

    test('sets isError on failure', async () => {
        vi.mocked(createSwapQuotes).mockRejectedValue(
            new Error('Network error'),
        )

        const { result } = renderHook(() => useCreateQuotesMutation(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.mutate(quote.request)
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
