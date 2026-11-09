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

import { mockCancelRampOrder } from '../../test-handlers'
import { historyItem, SCOPE } from '../../__tests__/routerFixtures'
import { onrampQueryKeys } from '../querykeys'
import { useCancelRampOrderMutation } from '../useCancelRampOrderMutation'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function createClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
}

const wrapperFor =
    (queryClient: QueryClient) =>
    ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

describe('onramp/useCancelRampOrderMutation', () => {
    test('resolves on a successful cancel', async () => {
        server.use(
            mockCancelRampOrder({
                response: historyItem({ status: 'cancelled' }),
            }),
        )

        const { result } = renderHook(() => useCancelRampOrderMutation(), {
            wrapper: wrapperFor(createClient()),
        })

        await result.current.mutateAsync({ scope: SCOPE, orderId: 'order-1' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    test('refreshes the history when the cancel is refused', async () => {
        server.use(
            mockCancelRampOrder({
                status: 409,
                response: {
                    error: 'Cannot cancel.',
                    code: 'invalid_status_transition',
                },
            }),
        )
        const queryClient = createClient()
        queryClient.setQueryData(
            onrampQueryKeys.history('device-1', 'ADDR', SCOPE),
            { pages: [], pageParams: [] },
        )
        const { result } = renderHook(() => useCancelRampOrderMutation(), {
            wrapper: wrapperFor(queryClient),
        })

        await expect(
            result.current.mutateAsync({ scope: SCOPE, orderId: 'order-1' }),
        ).rejects.toBeDefined()

        await waitFor(() =>
            expect(
                queryClient.getQueryState(
                    onrampQueryKeys.history('device-1', 'ADDR', SCOPE),
                )?.isInvalidated,
            ).toBe(true),
        )
    })
})
