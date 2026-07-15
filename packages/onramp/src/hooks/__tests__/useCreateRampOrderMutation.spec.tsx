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

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'

import { mockCreateRampOrder } from '../../test-handlers'
import type { RampOrderApiResponse } from '../../api/orders/schema'
import { useCreateRampOrderMutation } from '../useCreateRampOrderMutation'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const xoOrder: RampOrderApiResponse = {
    swap_order_id: 'order-1',
    xo: {
        pay_in_address: 'PAYIN_ADDRESS',
        source_amount: '100',
        provider_response: {
            payInAddress: 'PAYIN_ADDRESS',
            toAddress: 'DEST_ADDRESS',
            status: 'waiting',
        },
    },
    meld: null,
}

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

describe('onramp/useCreateRampOrderMutation', () => {
    test('returns the transformed order from mutateAsync', async () => {
        server.use(mockCreateRampOrder({ response: xoOrder }))

        const { result } = renderHook(() => useCreateRampOrderMutation(), {
            wrapper: createWrapper(),
        })

        const order = await result.current.mutateAsync({
            quote: 'quote-1',
            sourceAmount: '100',
            sourceAddress: 'SOURCE_ADDRESS',
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(order.swapOrderId).toBe('order-1')
        expect(order.kind).toBe('xo')
    })
})
