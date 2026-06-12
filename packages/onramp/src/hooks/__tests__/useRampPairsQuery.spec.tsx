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

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import React from 'react'

import { mockRampPairs } from '../../test-handlers'
import type { RampPairApiResponse } from '../../api/pairs/schema'
import { useRampPairsQuery } from '../useRampPairsQuery'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const apiPair: RampPairApiResponse = {
    id: 'pair-1',
    source_token: {
        id: 'usd',
        symbol: 'USD',
        name: 'US Dollar',
        fraction_decimals: 2,
        logo: null,
        network: { id: 'fiat', name: 'Fiat', logo: null },
        price_in_usd: '1',
        extra: { country_code: 'US' },
    },
    destination_token: {
        id: 'algo',
        symbol: 'ALGO',
        name: 'Algorand',
        fraction_decimals: 6,
        logo: null,
        network: { id: 'algorand', name: 'Algorand', logo: null },
        price_in_usd: null,
        extra: {},
    },
    provider: {
        id: 'meld',
        payment_types: ['CARD'],
        limits: { min_source_amount: '10', max_source_amount: '5000' },
    },
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

describe('onramp/useRampPairsQuery', () => {
    test('returns transformed pairs on success', async () => {
        server.use(mockRampPairs({ response: [apiPair] }))

        const { result } = renderHook(() => useRampPairsQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toHaveLength(1)
        expect(result.current.data?.[0].id).toBe('pair-1')
        expect(result.current.data?.[0].sourceToken.symbol).toBe('USD')
    })
})
