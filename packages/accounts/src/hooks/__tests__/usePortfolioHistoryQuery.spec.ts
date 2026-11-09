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
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    IntegrityRequiredError,
    PeraNetworkError,
} from '@perawallet/wallet-core-shared'
import { fetchPortfolioHistory } from '../../chain-adapter'
import { usePortfolioHistoryQuery } from '../usePortfolioHistoryQuery'

vi.mock('../../chain-adapter', async importOriginal => ({
    ...(await importOriginal<typeof import('../../chain-adapter')>()),
    fetchPortfolioHistory: vi.fn(),
}))

const chainsWithoutHistory = new Set<string>()
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapabilityCheck:
        () =>
        ({ chain }: { chain: { chainId: string } }) =>
            !chainsWithoutHistory.has(chain.chainId),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        usdToPreferred: (amount: Decimal) => amount.mul(2),
    }),
}))

const ALGORAND: ChainScope = {
    chainId: 'algorand' as ChainId,
    networkId: 'mainnet',
}
const ETHEREUM: ChainScope = {
    chainId: 'ethereum' as ChainId,
    networkId: 'mainnet',
}

const history = vi.mocked(fetchPortfolioHistory)

const both = [
    { address: 'ALGO', scope: ALGORAND },
    { address: '0xeth', scope: ETHEREUM },
]

const point = (timestamp: number, usd: string) => ({
    timestamp,
    usdValue: new Decimal(usd),
    nativeValue: new Decimal(1),
})

const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
        QueryClientProvider,
        {
            client: new QueryClient({
                defaultOptions: { queries: { retry: false } },
            }),
        },
        children,
    )

describe('usePortfolioHistoryQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        chainsWithoutHistory.clear()
    })

    it("sums each chain's history and converts it to the preferred currency", async () => {
        history.mockImplementation(async (_addresses, _period, scope) =>
            scope.chainId === ALGORAND.chainId
                ? [point(1, '10'), point(2, '20')]
                : [point(1, '100'), point(2, '200')],
        )
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-week', ALGORAND),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(history).toHaveBeenCalledTimes(2)
        expect(history).toHaveBeenCalledWith(
            ['ALGO'],
            'one-week',
            ALGORAND,
            expect.any(AbortSignal),
        )
        expect(history).toHaveBeenCalledWith(
            ['0xeth'],
            'one-week',
            ETHEREUM,
            expect.any(AbortSignal),
        )
        expect(result.current.data).toEqual([
            { datetime: new Date(1), preferredValue: new Decimal(220) },
            { datetime: new Date(2), preferredValue: new Decimal(440) },
        ])
    })

    it('fetches sources on one scope in a single request', async () => {
        history.mockResolvedValue([])
        const sources = [
            { address: 'A', scope: ALGORAND },
            { address: 'B', scope: ALGORAND },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(history).toHaveBeenCalledTimes(1)
        expect(history).toHaveBeenCalledWith(
            ['A', 'B'],
            'one-day',
            ALGORAND,
            expect.any(AbortSignal),
        )
        expect(result.current.data).toEqual([])
    })

    it("is unavailable, without a request, when a source's chain has no history", () => {
        chainsWithoutHistory.add(ETHEREUM.chainId)
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        expect(result.current.isUnavailableOnNetwork).toBe(true)
        expect(result.current.isPending).toBe(false)
        expect(history).not.toHaveBeenCalled()
    })

    it('drops the cached sum once a chain is switched off, so the chart does not keep drawing it', async () => {
        history.mockResolvedValue([point(1, '10')])
        const sources = [{ address: 'ALGO', scope: ALGORAND }]
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const sharedWrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client }, children)

        const { result, rerender } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper: sharedWrapper },
        )
        await waitFor(() => expect(result.current.data).toHaveLength(1))

        chainsWithoutHistory.add(ALGORAND.chainId)
        rerender()

        expect(result.current.isUnavailableOnNetwork).toBe(true)
        expect(result.current.data).toEqual([])
    })

    it("is unavailable, not a partial chart, when a chain's network serves no history", async () => {
        history.mockImplementation(async (_addresses, _period, scope) =>
            scope.chainId === ETHEREUM.chainId ? null : [point(1, '10')],
        )
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.isUnavailableOnNetwork).toBe(true),
        )
        expect(result.current.isPending).toBe(false)
        expect(result.current.data).toEqual([])
    })

    it('charts the funded chain when another has no points', async () => {
        history.mockImplementation(async (_addresses, _period, scope) =>
            scope.chainId === ALGORAND.chainId ? [] : [point(1, '10')],
        )
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(history).toHaveBeenCalledTimes(2)
        expect(result.current.isUnavailableOnNetwork).toBe(false)
        expect(result.current.data).toEqual([
            { datetime: new Date(1), preferredValue: new Decimal(20) },
        ])
    })

    it('charts the other chains and names the one whose history failed', async () => {
        history.mockImplementation(async (_addresses, _period, scope) => {
            if (scope.chainId === ETHEREUM.chainId) {
                throw new Error('history down')
            }
            return [point(1, '10')]
        })
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.excludedChainIds).toEqual([ETHEREUM.chainId]),
        )
        expect(result.current.isPartial).toBe(true)
        expect(result.current.isError).toBe(false)
        expect(result.current.isPending).toBe(false)
        expect(result.current.data).toEqual([
            { datetime: new Date(1), preferredValue: new Decimal(20) },
        ])
    })

    it('counts a chain the backend has not switched on as holding nothing, not as left out', async () => {
        history.mockImplementation(async (_addresses, _period, scope) => {
            if (scope.chainId === ETHEREUM.chainId) {
                throw new PeraNetworkError('client', {
                    status: 422,
                    backendCode: 'chain_not_enabled',
                })
            }
            return [point(1, '10')]
        })
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.isPartial).toBe(false)
        expect(result.current.isError).toBe(false)
        expect(result.current.data).toEqual([
            { datetime: new Date(1), preferredValue: new Decimal(20) },
        ])
    })

    it('reports an error, not an empty chart, when the chain that loaded has no points', async () => {
        history.mockImplementation(async (_addresses, _period, scope) => {
            if (scope.chainId === ETHEREUM.chainId) {
                throw new Error('history down')
            }
            return []
        })
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.isPending).toBe(false)
        expect(result.current.excludedChainIds).toEqual([])
    })

    it('stays loading, not failed, while the other chain is still loading', async () => {
        let resolveAlgorand: (
            points: ReturnType<typeof point>[],
        ) => void = () => {}
        history.mockImplementation((_addresses, _period, scope) =>
            scope.chainId === ETHEREUM.chainId
                ? Promise.reject(new Error('history down'))
                : new Promise(resolve => {
                      resolveAlgorand = resolve
                  }),
        )
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.excludedChainIds).toEqual([ETHEREUM.chainId]),
        )
        expect(result.current.isError).toBe(false)
        expect(result.current.isPending).toBe(true)

        resolveAlgorand([point(1, '10')])

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toHaveLength(1)
    })

    describe('when a chain that failed is asked again', () => {
        const pendingHistory = () => {
            let resolve: (points: ReturnType<typeof point>[]) => void = () => {}
            const promise = new Promise<ReturnType<typeof point>[]>(done => {
                resolve = done
            })
            return { promise, resolve }
        }
        const stableWrapper = () => {
            const client = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            })
            return ({ children }: { children: React.ReactNode }) =>
                React.createElement(QueryClientProvider, { client }, children)
        }
        it('keeps charting the other chains until it answers', async () => {
            const retried = pendingHistory()
            let ethereumCalls = 0
            history.mockImplementation(async (_addresses, _period, scope) => {
                if (scope.chainId === ALGORAND.chainId) return [point(1, '10')]
                ethereumCalls += 1
                if (ethereumCalls === 1) throw new Error('history down')
                return retried.promise
            })
            const { result } = renderHook(
                () => usePortfolioHistoryQuery(both, 'one-day', ALGORAND),
                { wrapper: stableWrapper() },
            )
            await waitFor(() =>
                expect(result.current.excludedChainIds).toEqual([
                    ETHEREUM.chainId,
                ]),
            )

            act(() => result.current.refetch())
            await waitFor(() => expect(ethereumCalls).toBe(2))

            expect(result.current.data).toEqual([
                { datetime: new Date(1), preferredValue: new Decimal(20) },
            ])
            expect(result.current.isPending).toBe(false)
            expect(result.current.isError).toBe(false)
            expect(result.current.isRetrying).toBe(false)
            expect(result.current.excludedChainIds).toEqual([ETHEREUM.chainId])

            retried.resolve([point(1, '5')])

            await waitFor(() =>
                expect(result.current.excludedChainIds).toEqual([]),
            )
            expect(result.current.isPartial).toBe(false)
            expect(result.current.data).toEqual([
                { datetime: new Date(1), preferredValue: new Decimal(30) },
            ])
        })

        it('stays an error, not loading, while it is the only chain with nothing to plot', async () => {
            const retried = pendingHistory()
            let ethereumCalls = 0
            history.mockImplementation(async (_addresses, _period, scope) => {
                if (scope.chainId === ALGORAND.chainId) return []
                ethereumCalls += 1
                if (ethereumCalls === 1) throw new Error('history down')
                return retried.promise
            })
            const { result } = renderHook(
                () => usePortfolioHistoryQuery(both, 'one-day', ALGORAND),
                { wrapper: stableWrapper() },
            )
            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.isRetrying).toBe(false)

            act(() => result.current.refetch())
            await waitFor(() => expect(ethereumCalls).toBe(2))

            expect(result.current.isError).toBe(true)
            expect(result.current.error).toEqual(new Error('history down'))
            expect(result.current.isPending).toBe(false)
            expect(result.current.isRetrying).toBe(true)

            retried.resolve([point(1, '5')])

            await waitFor(() => expect(result.current.isError).toBe(false))
            expect(result.current.isRetrying).toBe(false)
            expect(result.current.error).toBeNull()
            expect(result.current.data).toEqual([
                { datetime: new Date(1), preferredValue: new Decimal(10) },
            ])
        })

        it('stays an integrity block, not a partial chart, while the blocked chain is asked again', async () => {
            const blocked = new IntegrityRequiredError({
                code: null,
                status: 401,
                hadToken: false,
            })
            const retried = pendingHistory()
            let ethereumCalls = 0
            history.mockImplementation(async (_addresses, _period, scope) => {
                if (scope.chainId === ALGORAND.chainId) return [point(1, '10')]
                ethereumCalls += 1
                if (ethereumCalls === 1) throw blocked
                return retried.promise
            })
            const { result } = renderHook(
                () => usePortfolioHistoryQuery(both, 'one-day', ALGORAND),
                { wrapper: stableWrapper() },
            )
            await waitFor(() => expect(result.current.isError).toBe(true))

            act(() => result.current.refetch())
            await waitFor(() => expect(ethereumCalls).toBe(2))

            expect(result.current.isPartial).toBe(false)
            expect(result.current.excludedChainIds).toEqual([])
            expect(result.current.isError).toBe(true)
            expect(result.current.error).toBe(blocked)
            expect(result.current.isPending).toBe(false)
            expect(result.current.isRetrying).toBe(true)

            retried.resolve([point(1, '5')])

            await waitFor(() => expect(result.current.isError).toBe(false))
            expect(result.current.data).toEqual([
                { datetime: new Date(1), preferredValue: new Decimal(30) },
            ])
        })
    })

    it('stays loading, not failed, while a chain loads beside one whose refresh failed', async () => {
        const loading: {
            resolve: (points: ReturnType<typeof point>[]) => void
        } = { resolve: () => {} }
        let algorandCalls = 0
        history.mockImplementation((_addresses, _period, scope) => {
            if (scope.chainId === ETHEREUM.chainId) {
                return new Promise(resolve => {
                    loading.resolve = resolve
                })
            }
            algorandCalls += 1
            return algorandCalls === 1
                ? Promise.resolve([point(1, '10')])
                : Promise.reject(new Error('history down'))
        })
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const sharedWrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client }, children)
        const { result, rerender } = renderHook(
            ({ sources }) =>
                usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            {
                wrapper: sharedWrapper,
                initialProps: {
                    sources: [{ address: 'ALGO', scope: ALGORAND }],
                },
            },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))
        act(() => result.current.refetch())
        await waitFor(() => expect(algorandCalls).toBe(2))
        await waitFor(() => expect(client.isFetching()).toBe(0))

        rerender({ sources: both })

        await waitFor(() => expect(result.current.isPending).toBe(true))
        expect(result.current.isError).toBe(false)
        expect(result.current.data).toEqual([])

        loading.resolve([point(1, '5')])

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toEqual([
            { datetime: new Date(1), preferredValue: new Decimal(30) },
        ])
    })

    it('reports an error when every chain fails', async () => {
        history.mockRejectedValue(new Error('history down'))
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toEqual(new Error('history down'))
        expect(result.current.excludedChainIds).toEqual([])
        expect(result.current.isPartial).toBe(false)
        expect(result.current.data).toEqual([])
    })

    it('fails the chart, rather than leaving the chain out, on an integrity block', async () => {
        const blocked = new IntegrityRequiredError({
            code: null,
            status: 401,
            hadToken: false,
        })
        history.mockImplementation(async (_addresses, _period, scope) => {
            if (scope.chainId === ETHEREUM.chainId) throw blocked
            return [point(1, '10')]
        })
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBe(blocked)
        expect(result.current.excludedChainIds).toEqual([])
    })

    it('does not fetch while disabled', () => {
        const { result } = renderHook(
            () =>
                usePortfolioHistoryQuery(
                    [{ address: 'ALGO', scope: ALGORAND }],
                    'one-day',
                    ALGORAND,
                    false,
                ),
            { wrapper },
        )

        expect(history).not.toHaveBeenCalled()
        expect(result.current.data).toEqual([])
    })

    it('is settled and empty with no sources', () => {
        const { result } = renderHook(
            () => usePortfolioHistoryQuery([], 'one-day', ALGORAND),
            { wrapper },
        )

        expect(result.current.isPending).toBe(false)
        expect(result.current.data).toEqual([])
        expect(history).not.toHaveBeenCalled()
    })
})
