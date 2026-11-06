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
    vi,
} from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import React from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

import { mockRampDestinations } from '../../test-handlers'
import { rampChainAdapters } from '../../chain-adapter'
import { registerFakeRampAdapter } from '../../__tests__/fakeRampAdapter'
import {
    SCOPE,
    nativeAsset,
    pairRow,
    registerRouterChain,
    stableAsset,
} from '../../__tests__/routerFixtures'
import { useCanBuyAsset } from '../useCanBuyAsset'

const mocks = vi.hoisted(() => ({ capabilityScope: vi.fn() }))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountCapabilityScope: mocks.capabilityScope,
}))

const server = setupServer()
const account = {
    id: 'a',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: 'ADDRESS' } },
} as unknown as WalletAccount

const LISTED_ASSET_ID = '42'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
    registerRouterChain()
    mocks.capabilityScope.mockReset()
    mocks.capabilityScope.mockReturnValue(SCOPE)
})
afterEach(() => {
    server.resetHandlers()
    rampChainAdapters.reset()
})
afterAll(() => server.close())

const createWrapper = () => {
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

const countRequests = () => {
    const requests = { count: 0 }
    server.use(
        http.get('*/api/v4/swap/pairs/', () => {
            requests.count += 1
            return HttpResponse.json({ next: null, results: [] })
        }),
    )
    return requests
}

describe('onramp/useCanBuyAsset', () => {
    describe('on a chain that offers Buy on every asset', () => {
        beforeEach(() => registerFakeRampAdapter())

        test('is true for any asset without asking the router', () => {
            const requests = countRequests()

            const { result } = renderHook(
                () =>
                    useCanBuyAsset({
                        account,
                        chainId: 'algorand',
                        assetId: 'unlisted',
                    }),
                { wrapper: createWrapper() },
            )

            expect(result.current).toBe(true)
            expect(requests.count).toBe(0)
        })

        test('is false when the chain has no onramp for the account', () => {
            mocks.capabilityScope.mockReturnValue(null)

            const { result } = renderHook(
                () =>
                    useCanBuyAsset({
                        account,
                        chainId: 'algorand',
                        assetId: LISTED_ASSET_ID,
                    }),
                { wrapper: createWrapper() },
            )

            expect(result.current).toBe(false)
        })
    })

    describe('on a chain that limits Buy to the router destinations', () => {
        beforeEach(() =>
            registerFakeRampAdapter({ isBuyLimitedToDestinations: true }),
        )

        test('is true for a listed token', async () => {
            server.use(
                mockRampDestinations({
                    response: {
                        next: null,
                        results: [pairRow(stableAsset())],
                    },
                }),
            )

            const { result } = renderHook(
                () =>
                    useCanBuyAsset({
                        account,
                        chainId: 'algorand',
                        assetId: LISTED_ASSET_ID,
                    }),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current).toBe(true))
        })

        test('is false for a token the router does not list', async () => {
            server.use(
                mockRampDestinations({
                    response: { next: null, results: [pairRow(nativeAsset())] },
                }),
            )

            const { result, rerender } = renderHook(
                () =>
                    useCanBuyAsset({
                        account,
                        chainId: 'algorand',
                        assetId: LISTED_ASSET_ID,
                    }),
                { wrapper: createWrapper() },
            )
            await new Promise(resolve => setTimeout(resolve, 50))
            rerender()

            expect(result.current).toBe(false)
        })

        test('is false while the list fails to load', async () => {
            server.use(
                http.get('*/api/v4/swap/pairs/', () =>
                    HttpResponse.json({}, { status: 500 }),
                ),
            )

            const { result, rerender } = renderHook(
                () =>
                    useCanBuyAsset({
                        account,
                        chainId: 'algorand',
                        assetId: LISTED_ASSET_ID,
                    }),
                { wrapper: createWrapper() },
            )
            await new Promise(resolve => setTimeout(resolve, 50))
            rerender()

            expect(result.current).toBe(false)
        })

        test('answers for the chain alone with no asset, without asking the router', () => {
            const requests = countRequests()

            const { result } = renderHook(
                () => useCanBuyAsset({ account, chainId: 'algorand' }),
                { wrapper: createWrapper() },
            )

            expect(result.current).toBe(true)
            expect(requests.count).toBe(0)
        })
    })
})
