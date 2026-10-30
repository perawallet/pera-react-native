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

import { mockRampPairs } from '../../test-handlers'
import type { RampPairApiResponse } from '../../api/pairs/schema'
import { useRampPairsQuery } from '../useRampPairsQuery'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { registerFakeRampAdapter } from '../../__tests__/fakeRampAdapter'
import { registerFakeChain } from '../../__tests__/fakeChains'

const { restrictedFeatures } = vi.hoisted(() => ({
    restrictedFeatures: new Set<string>(),
}))

vi.mock('@perawallet/wallet-core-remote-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-remote-config')
    >()),
    useRemoteConfig: () => ({}),
    isRegionRestricted: (_: unknown, feature: string) =>
        restrictedFeatures.has(feature),
}))

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
beforeEach(() => {
    restrictedFeatures.clear()
    getProvider().chains.reset()
    registerFakeRampAdapter()
})

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

        const { result } = renderHook(
            () => useRampPairsQuery({ scope: SCOPE }),
            {
                wrapper: createWrapper(),
            },
        )

        await waitFor(() => expect(result.current.data).toHaveLength(1))

        expect(result.current.data?.[0].id).toBe('pair-1')
        expect(result.current.data?.[0].sourceToken.symbol).toBe('USD')
    })
    test('hands the failure to the caller', async () => {
        server.use(mockRampPairs({ response: [], status: 503 }))

        const { result } = renderHook(
            () => useRampPairsQuery({ scope: SCOPE }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(Error)
    })

    test('returns one stable empty array while disabled', () => {
        const { result, rerender } = renderHook(
            () => useRampPairsQuery({ scope: SCOPE, enabled: false }),
            { wrapper: createWrapper() },
        )
        const initialData = result.current.data

        rerender()

        expect(initialData).toEqual([])
        expect(result.current.data).toBe(initialData)
    })

    test("asks for the chain adapter's destination tokens", async () => {
        let requested: string | null = null
        server.use(
            http.get('*/v1/ramp/pairs/', ({ request }) => {
                requested = new URL(request.url).searchParams.get(
                    'destination_tokens',
                )
                return HttpResponse.json([apiPair])
            }),
        )

        const { result } = renderHook(
            () => useRampPairsQuery({ scope: SCOPE }),
            {
                wrapper: createWrapper(),
            },
        )

        await waitFor(() => expect(result.current.data).toHaveLength(1))
        expect(requested).toBe('NATIVE,STABLE')
    })

    test('stays idle without a scope', () => {
        const { result } = renderHook(
            () => useRampPairsQuery({ scope: null }),
            { wrapper: createWrapper() },
        )

        expect(result.current.data).toEqual([])
        expect(result.current.fetchStatus).toBe('idle')
    })

    describe('crypto sources', () => {
        const ethereumSource: RampPairApiResponse = {
            ...apiPair,
            id: 'pair-eth',
            source_token: {
                ...apiPair.source_token,
                id: 'ETH',
                symbol: 'ETH',
                network: { id: 'ETHEREUM', name: 'Ethereum', logo: null },
                caip19: 'eip155:1/slip44:60',
                extra: {},
            },
        }
        const bitcoinSource: RampPairApiResponse = {
            ...apiPair,
            id: 'pair-btc',
            source_token: {
                ...apiPair.source_token,
                id: 'BTC',
                symbol: 'BTC',
                network: { id: 'BITCOIN', name: 'Bitcoin', logo: null },
                caip19: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
                extra: {},
            },
        }

        const offeredIds = async () => {
            server.use(
                mockRampPairs({
                    response: [apiPair, ethereumSource, bitcoinSource],
                }),
            )
            const { result } = renderHook(
                () => useRampPairsQuery({ scope: SCOPE }),
                { wrapper: createWrapper() },
            )
            await waitFor(() =>
                expect(result.current.data.length).toBeGreaterThan(0),
            )
            return result.current.data.map(pair => pair.id)
        }

        test('leaves out a source on a chain the wallet runs', async () => {
            registerFakeChain({ chainId: 'ethereum', caip2: 'eip155:1' })

            expect(await offeredIds()).toEqual(['pair-1', 'pair-btc'])
        })

        test('offers that source while the chain is not enabled', async () => {
            expect(await offeredIds()).toEqual([
                'pair-1',
                'pair-eth',
                'pair-btc',
            ])
        })
    })

    describe('XO Swap', () => {
        const xoPair: RampPairApiResponse = {
            ...apiPair,
            id: 'pair-xo',
            provider: { ...apiPair.provider, id: 'XO' },
        }

        const offeredIds = async () => {
            server.use(mockRampPairs({ response: [apiPair, xoPair] }))
            const { result } = renderHook(
                () => useRampPairsQuery({ scope: SCOPE }),
                { wrapper: createWrapper() },
            )
            await waitFor(() =>
                expect(result.current.data.length).toBeGreaterThan(0),
            )
            return result.current.data.map(pair => pair.id)
        }

        test('offers XO pairs outside the restricted countries', async () => {
            expect(await offeredIds()).toEqual(['pair-1', 'pair-xo'])
        })

        test.each(['xo_swap', 'swap'])(
            'leaves XO pairs out where %s is restricted in the device region',
            async feature => {
                restrictedFeatures.add(feature)

                expect(await offeredIds()).toEqual(['pair-1'])
            },
        )
    })
})
