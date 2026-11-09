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
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import React from 'react'

import { mockRampHistory } from '../../test-handlers'
import {
    ACCOUNT,
    SCOPE,
    historyItem,
    registerRouterChain,
} from '../../__tests__/routerFixtures'
import {
    useRampHistoryInfiniteQuery,
    getRampHistoryRefetchIntervalMs,
} from '../useRampHistoryInfiniteQuery'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => registerRouterChain())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const firstPage = {
    next: 'https://api.example/api/v4/swap/history/?cursor=c2',
    previous: null,
    results: [historyItem({ order_id: '1' })],
}

const secondPage = {
    next: null,
    previous: null,
    results: [historyItem({ order_id: '2' })],
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

describe('onramp/useRampHistoryInfiniteQuery', () => {
    test('paginates across two pages and flips hasNextPage', async () => {
        server.use(mockRampHistory({ response: firstPage }))

        const { result } = renderHook(
            () =>
                useRampHistoryInfiniteQuery({
                    scope: SCOPE,
                    deviceId: 'device-1',
                    accountAddress: ACCOUNT,
                }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.items).toHaveLength(1)
        expect(result.current.items[0].id).toBe('1')
        expect(result.current.hasNextPage).toBe(true)

        server.use(mockRampHistory({ response: secondPage }))

        await act(async () => {
            result.current.fetchNextPage()
        })

        await waitFor(() => expect(result.current.items).toHaveLength(2))

        expect(result.current.items[1].id).toBe('2')
        expect(result.current.hasNextPage).toBe(false)
    })

    test('is disabled without deviceId or accountAddress', async () => {
        const { result } = renderHook(
            () =>
                useRampHistoryInfiniteQuery({
                    scope: SCOPE,
                    deviceId: '',
                    accountAddress: '',
                }),
            { wrapper: createWrapper() },
        )

        expect(result.current.items).toEqual([])
        expect(result.current.isLoading).toBe(false)
    })
})

describe('getRampHistoryRefetchIntervalMs', () => {
    test('backs off to 60s on a 404 PeraNetworkError (post-migration shape)', () => {
        const notFound = new PeraNetworkError('client', { status: 404 })
        expect(getRampHistoryRefetchIntervalMs(notFound, true)).toBe(60_000)
    })

    test('polls at 10s for a non-404 error while active', () => {
        const serverError = new PeraNetworkError('server', { status: 500 })
        expect(getRampHistoryRefetchIntervalMs(serverError, true)).toBe(10_000)
    })

    test('polls at 10s when there is no error', () => {
        expect(getRampHistoryRefetchIntervalMs(null, true)).toBe(10_000)
    })

    test('stops polling when inactive regardless of error', () => {
        const notFound = new PeraNetworkError('client', { status: 404 })
        expect(getRampHistoryRefetchIntervalMs(notFound, false)).toBe(false)
    })
})
