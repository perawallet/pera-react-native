/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useCreateQuotesMutation } from '../useCreateQuotesMutation'
import { createQuotes } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../api', () => ({
    createQuotes: vi.fn(),
}))

const mockAsset = { assetId: 0, verificationTier: 'verified' as const }
const mockQuote = {
    id: 1,
    assetIn: mockAsset,
    assetOut: mockAsset,
    amountIn: '1000000',
    amountOut: '2000000',
}

const mockRequest = {
    swapper_address: 'ALGO_ADDRESS',
    swap_type: 'fixed-input' as const,
    asset_in_id: 0,
    asset_out_id: 31566704,
    amount: '1000000',
}

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
        vi.mocked(createQuotes).mockResolvedValue([mockQuote])
    })

    test('calls createQuotes with correct args and returns data', async () => {
        const { result } = renderHook(() => useCreateQuotesMutation(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.createQuotes(mockRequest)
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(createQuotes).toHaveBeenCalledWith(mockRequest, 'mainnet')
        expect(result.current.data).toEqual([mockQuote])
    })

    test('sets isError on failure', async () => {
        vi.mocked(createQuotes).mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useCreateQuotesMutation(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.createQuotes(mockRequest)
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
