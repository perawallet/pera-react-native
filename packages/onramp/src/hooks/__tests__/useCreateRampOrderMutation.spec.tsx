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
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'

import { mockCreateRampOrder } from '../../test-handlers'
import type { RampOrderApiInput } from '../../api/orders/schema'
import { SCOPE } from '../../__tests__/routerFixtures'
import { useCreateRampOrderMutation } from '../useCreateRampOrderMutation'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const xoOrder: RampOrderApiInput = {
    order_id: 'order-1',
    status: 'pending',
    expires_at: null,
    steps: [
        {
            kind: 'deposit_instructions',
            address: 'PAYIN_ADDRESS',
            memo: null,
        },
    ],
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
            scope: SCOPE,
            quoteId: 'quote-1',
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(order.orderId).toBe('order-1')
        expect(order.kind).toBe('xo')
    })
})
