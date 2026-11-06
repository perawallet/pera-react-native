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
import { http } from 'msw'
import { setupServer } from 'msw/node'
import React from 'react'

import { mockRampDestinations } from '../../test-handlers'
import { rampChainAdapters } from '../../chain-adapter'
import { registerFakeRampAdapter } from '../../__tests__/fakeRampAdapter'
import {
    NATIVE_ID,
    SCOPE,
    nativeAsset,
    pairRow,
    registerRouterChain,
    stableAsset,
} from '../../__tests__/routerFixtures'
import { useRampDestinationsQuery } from '../useRampDestinationsQuery'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
    registerRouterChain()
    registerFakeRampAdapter()
})
afterEach(() => {
    server.resetHandlers()
    rampChainAdapters.reset()
})
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

describe('onramp/useRampDestinationsQuery', () => {
    test("keeps only the destinations on the scope's chain", async () => {
        server.use(
            mockRampDestinations({
                response: {
                    next: null,
                    results: [
                        pairRow(nativeAsset()),
                        pairRow(stableAsset({ asset_id: 'other:1/token:7' })),
                    ],
                },
            }),
        )

        const { result } = renderHook(
            () => useRampDestinationsQuery({ scope: SCOPE }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.data).toHaveLength(1))

        expect(result.current.data[0].id).toBe(NATIVE_ID)
    })

    test('does not fetch for a null scope', async () => {
        let requested = false
        server.use(
            http.get('*/api/v4/swap/pairs/', () => {
                requested = true
                return undefined
            }),
        )

        const { result } = renderHook(
            () => useRampDestinationsQuery({ scope: null }),
            { wrapper: createWrapper() },
        )

        expect(result.current.data).toEqual([])
        expect(result.current.fetchStatus).toBe('idle')
        expect(requested).toBe(false)
    })

    test('does not fetch for a chain without a ramp adapter', () => {
        rampChainAdapters.reset()

        const { result } = renderHook(
            () => useRampDestinationsQuery({ scope: SCOPE }),
            { wrapper: createWrapper() },
        )

        expect(result.current.fetchStatus).toBe('idle')
    })
})
