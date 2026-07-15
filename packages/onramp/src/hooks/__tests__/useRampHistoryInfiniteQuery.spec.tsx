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
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import React from 'react'

import { mockRampHistory } from '../../test-handlers'
import type {
    RampHistoryItemApiResponse,
    RampHistoryPageApiResponse,
} from '../../api/history/schema'
import {
    useRampHistoryInfiniteQuery,
    getRampHistoryRefetchIntervalMs,
} from '../useRampHistoryInfiniteQuery'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const buildItem = (id: string): RampHistoryItemApiResponse => ({
    id,
    creation_datetime: '2025-06-01T10:00:00Z',
    status: 'completed',
    ramp_quote: {
        id: `quote-${id}`,
        provider: 'meld',
        payment_method: { id: 'card', logo: null, name: 'Credit Card' },
        pair: {
            id: 'pair-1',
            source_token: {
                id: 'usd',
                symbol: 'USD',
                name: 'US Dollar',
                fraction_decimals: 2,
                logo: null,
                network: { id: 'fiat', name: 'Fiat', logo: null },
                price_in_usd: '1',
                extra: {},
            },
            destination_token: {
                id: '0',
                symbol: 'ALGO',
                name: 'Algorand',
                fraction_decimals: 6,
                logo: null,
                network: { id: 'algorand', name: 'Algorand', logo: null },
                price_in_usd: '0.25',
                extra: {},
            },
            provider: { id: 'meld', payment_types: ['card'], limits: null },
        },
        provider_responses: {
            quotes_response: {
                sourceAmount: 100,
                destinationAmount: 475.5,
                sourceCurrencyCode: 'USD',
                destinationCurrencyCode: 'ALGO',
                serviceProvider: 'TRANSAK',
            },
            order_response: { id: `meld-order-${id}` },
        },
    },
})

const firstPage: RampHistoryPageApiResponse = {
    count: 2,
    next: 'https://mainnet.staging.api.perawallet.app/v1/ramp/history/device-1/ADDRESS/?offset=1',
    previous: null,
    results: [buildItem('1')],
}

const secondPage: RampHistoryPageApiResponse = {
    count: 2,
    next: null,
    previous: null,
    results: [buildItem('2')],
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
        // Both pages hit `*/v1/ramp/history/*`; swap the handler between fetches
        // so each call resolves the next page.
        server.use(mockRampHistory({ response: firstPage }))

        const { result } = renderHook(
            () =>
                useRampHistoryInfiniteQuery({
                    deviceId: 'device-1',
                    accountAddress: 'ADDRESS',
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
