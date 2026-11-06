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
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
} from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'

import { mockRampHistory } from '../../test-handlers'
import {
    ACCOUNT,
    SCOPE,
    historyItem,
    registerRouterChain,
} from '../../__tests__/routerFixtures'
import { useRampHistoryInfiniteQuery } from '../useRampHistoryInfiniteQuery'
import type { OnrampStatus } from '../../models'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => registerRouterChain())
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

describe('onramp/useRampHistoryInfiniteQuery status filtering', () => {
    test('filters the loaded items by status and clearing it restores the full list', async () => {
        server.use(
            mockRampHistory({
                response: {
                    next: null,
                    results: [
                        historyItem({ order_id: '1', status: 'completed' }),
                        historyItem({ order_id: '2', status: 'pending' }),
                        historyItem({ order_id: '3', status: 'expired' }),
                    ],
                },
            }),
        )

        const { result, rerender } = renderHook(
            ({ status }: { status?: OnrampStatus }) =>
                useRampHistoryInfiniteQuery({
                    scope: SCOPE,
                    deviceId: 'device-1',
                    accountAddress: ACCOUNT,
                    status,
                }),
            {
                wrapper: createWrapper(),
                initialProps: { status: undefined as OnrampStatus | undefined },
            },
        )

        await waitFor(() => expect(result.current.items).toHaveLength(3))

        rerender({ status: 'pending' })
        expect(result.current.items.map(item => item.id)).toEqual(['2'])

        rerender({ status: undefined })
        expect(result.current.items).toHaveLength(3)
    })
})
