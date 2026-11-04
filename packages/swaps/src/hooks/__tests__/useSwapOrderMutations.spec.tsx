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
import { describe, test, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useCreateSwapOrderMutation } from '../useCreateSwapOrderMutation'
import { useReportSwapOrderMutation } from '../useReportSwapOrderMutation'
import { createSwapOrder, reportSwapOrder } from '../../api'

vi.mock('../../api', () => ({
    createSwapOrder: vi.fn(),
    reportSwapOrder: vi.fn(),
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        children,
    )

describe('swaps/order mutations', () => {
    test('creates an order for the quote on the scope', async () => {
        vi.mocked(createSwapOrder).mockResolvedValue({
            orderId: 'order-1',
            status: 'pending',
            expiresAt: null,
            steps: [],
        })
        const { result } = renderHook(() => useCreateSwapOrderMutation(), {
            wrapper,
        })

        act(() => {
            result.current.mutate({ quoteId: 'quote-1', scope: SCOPE })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(createSwapOrder).toHaveBeenCalledWith('quote-1', SCOPE)
    })

    test('reports the order on the scope', async () => {
        vi.mocked(reportSwapOrder).mockResolvedValue(
            {} as Awaited<ReturnType<typeof reportSwapOrder>>,
        )
        const { result } = renderHook(() => useReportSwapOrderMutation(), {
            wrapper,
        })

        act(() => {
            result.current.mutate({
                orderId: 'order-1',
                report: { status: 'cancelled' },
                scope: SCOPE,
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(reportSwapOrder).toHaveBeenCalledWith(
            'order-1',
            { status: 'cancelled' },
            SCOPE,
        )
    })
})
