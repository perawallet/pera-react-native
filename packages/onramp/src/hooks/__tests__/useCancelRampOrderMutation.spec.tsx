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

import { mockCancelRampOrder } from '../../test-handlers'
import { useCancelRampOrderMutation } from '../useCancelRampOrderMutation'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

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

describe('onramp/useCancelRampOrderMutation', () => {
    test('resolves on a successful cancel', async () => {
        server.use(
            mockCancelRampOrder({
                response: {
                    swap_order_id: 'order-1',
                    device_id: 'device-1',
                    account_address: 'ACCOUNT_ADDRESS',
                },
            }),
        )

        const { result } = renderHook(() => useCancelRampOrderMutation(), {
            wrapper: createWrapper(),
        })

        await result.current.mutateAsync({
            swapOrderId: 'order-1',
            deviceId: 'device-1',
            accountAddress: 'ACCOUNT_ADDRESS',
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })
})
