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
import { http, HttpResponse } from 'msw'
import React from 'react'

import type {
    RampHistoryItemApiResponse,
    RampHistoryPageApiResponse,
} from '../../api/history/schema'
import { useRampHistoryInfiniteQuery } from '../useRampHistoryInfiniteQuery'
import type { OnrampStatus } from '../../models'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const buildItem = (
    id: string,
    status: 'completed' | 'pending',
): RampHistoryItemApiResponse => ({
    id,
    creation_datetime: '2025-06-01T10:00:00Z',
    status,
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

const allItems = [buildItem('1', 'completed'), buildItem('2', 'pending')]

// Honours the `status` query param like the real backend, so the test
// exercises true server-side filtering across key switches.
const filteringHandler = http.get('*/v1/ramp/history/*', ({ request }) => {
    const status = new URL(request.url).searchParams.get('status')
    const results = status
        ? allItems.filter(item => item.status === status)
        : allItems
    const page: RampHistoryPageApiResponse = {
        count: results.length,
        next: null,
        previous: null,
        results,
    }
    return HttpResponse.json(page)
})

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
    test('filtering then clearing the status round-trips to the full list', async () => {
        server.use(filteringHandler)

        const { result, rerender } = renderHook(
            ({ status }: { status?: OnrampStatus }) =>
                useRampHistoryInfiniteQuery({
                    deviceId: 'device-1',
                    accountAddress: 'ADDRESS',
                    status,
                }),
            {
                wrapper: createWrapper(),
                initialProps: { status: undefined as OnrampStatus | undefined },
            },
        )

        await waitFor(() => expect(result.current.items).toHaveLength(2))

        rerender({ status: 'pending' })
        await waitFor(() => expect(result.current.items).toHaveLength(1))
        expect(result.current.items[0].id).toBe('2')

        rerender({ status: undefined })
        await waitFor(() => expect(result.current.items).toHaveLength(2))
    })
})
