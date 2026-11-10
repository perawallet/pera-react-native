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

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'

const mockCreateQuotes = vi.fn()
const mockResetQuoteMutation = vi.fn()
let mockAssetsQueryResult: {
    data: Map<string, unknown>
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

vi.mock('@perawallet/wallet-core-swaps', async () => {
    const { swapQuoteFailureOf } = await vi.importActual<
        typeof import('@packages/swaps/src/utils/routerErrors')
    >('@packages/swaps/src/utils/routerErrors')
    return {
        swapQuoteFailureOf,
        useCreateQuotesMutation: () => ({
            mutateAsync: mockCreateQuotes,
            isPending: false,
            reset: mockResetQuoteMutation,
        }),
    }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        useDebouncedValue: <T>(value: T) => value,
    }
})

const mockUseAssetsQuery = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: mockUseAssetsQuery,
}))

import { useSwapQuotes } from '../useSwapQuotes'

const makeAssetsResult = (ids: string[]) => ({
    data: new Map(ids.map(id => [id, { assetId: id }])),
    isPending: false,
    isFetched: true,
    isRefetching: false,
    isError: false,
})

const OFFER = { provider: 'xo-v4' } as never

const routerRefusal = (
    status: number,
    code: string,
    extra: Record<string, unknown> = {},
) =>
    new PeraNetworkError(status >= 500 ? 'server' : 'client', {
        status,
        originalError: Object.assign(new Error('http'), {
            data: { error: code, code, ...extra },
        }),
    })

const baseParams = {
    scope: { chainId: 'algorand', networkId: 'testnet' } as const,
    swapperAddress: 'SWAPPER',
    fromAssetId: '0',
    toAssetId: '31566704',
    payAmount: new Decimal(1),
    payDecimals: 6,
}

describe('useSwapQuotes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAssetsQueryResult = makeAssetsResult(['0', '31566704'])
        mockUseAssetsQuery.mockImplementation(() => mockAssetsQueryResult)
        mockCreateQuotes.mockResolvedValue([])
    })

    it('asks for the pair on the scope in base units, receiving to the swapper', async () => {
        renderHook(() => useSwapQuotes({ ...baseParams, slippage: '0.5' }))

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))
        expect(mockCreateQuotes).toHaveBeenCalledWith({
            sourceAsset: {
                chainId: 'algorand',
                networkId: 'testnet',
                assetId: '0',
            },
            destinationAsset: {
                chainId: 'algorand',
                networkId: 'testnet',
                assetId: '31566704',
            },
            sourceAmount: new Decimal(1_000_000),
            sourceAddress: 'SWAPPER',
            destinationAddress: 'SWAPPER',
            slippage: '0.5',
        })
    })

    it('leaves slippage to the router when none is set', async () => {
        renderHook(() => useSwapQuotes(baseParams))

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))
        expect(mockCreateQuotes.mock.calls[0][0].slippage).toBeNull()
    })

    it('clears the quotes when the request itself is refused, e.g. on a custom node', async () => {
        mockCreateQuotes.mockRejectedValue(new Error('service unavailable'))

        const { result } = renderHook(() => useSwapQuotes(baseParams))

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))
        expect(result.current.allQuotes).toEqual([])
        expect(result.current.quotedAmount).toBeNull()
    })

    it('treats a quote 404 as terminal for the current pair', async () => {
        mockCreateQuotes.mockRejectedValue({ response: { status: 404 } })

        const { rerender } = renderHook(
            (props: typeof baseParams) => useSwapQuotes(props),
            { initialProps: baseParams },
        )

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))

        rerender({ ...baseParams, payAmount: new Decimal(2) })
        rerender({ ...baseParams, payAmount: new Decimal(3) })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(1)
    })

    it('surfaces a terminal 404 as a quote error with the spinner off', async () => {
        mockCreateQuotes.mockRejectedValue({ response: { status: 404 } })

        const { result } = renderHook(() => useSwapQuotes(baseParams))

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(result.current.isQuoteError).toBe(true))
        expect(result.current.isQuoteFetching).toBe(false)
    })

    it('reset() clears the terminal 404 so the pair can be quoted again', async () => {
        mockCreateQuotes.mockRejectedValue({ response: { status: 404 } })

        const { result } = renderHook(() => useSwapQuotes(baseParams))
        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(result.current.isQuoteError).toBe(true))

        mockCreateQuotes.mockResolvedValue([OFFER])
        act(() => result.current.reset())

        expect(result.current.isQuoteError).toBe(false)
        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(result.current.isQuoteError).toBe(false))
    })

    describe('quoteFailure', () => {
        it('reports no route when the router answers with no offers', async () => {
            mockCreateQuotes.mockResolvedValue([])

            const { result } = renderHook(() => useSwapQuotes(baseParams))

            await waitFor(() =>
                expect(result.current.quoteFailure).toEqual({
                    kind: 'no-route',
                }),
            )
            expect(result.current.isQuoteFetching).toBe(false)
        })

        it('classifies a router refusal from its body', async () => {
            mockCreateQuotes.mockRejectedValue(
                routerRefusal(422, 'amount_too_low', {
                    source_amount_minimum: '2000',
                }),
            )

            const { result } = renderHook(() => useSwapQuotes(baseParams))

            await waitFor(() =>
                expect(result.current.quoteFailure).toEqual({
                    kind: 'amount-too-low',
                    minimum: new Decimal(2000),
                }),
            )
        })

        it('retries an unavailable route once on refresh and clears on success', async () => {
            mockCreateQuotes.mockRejectedValueOnce(
                routerRefusal(503, 'route_unavailable'),
            )
            mockCreateQuotes.mockResolvedValue([OFFER])

            const { result } = renderHook(() => useSwapQuotes(baseParams))
            await waitFor(() =>
                expect(result.current.quoteFailure).toEqual({
                    kind: 'unavailable',
                }),
            )
            expect(mockCreateQuotes).toHaveBeenCalledTimes(1)

            act(() => result.current.refresh())

            await waitFor(() => expect(result.current.quoteFailure).toBeNull())
            expect(mockCreateQuotes).toHaveBeenCalledTimes(2)
            expect(result.current.allQuotes).toEqual([OFFER])
        })

        it('is cleared by reset()', async () => {
            mockCreateQuotes.mockRejectedValue(
                routerRefusal(503, 'route_unavailable'),
            )
            const { result } = renderHook(() => useSwapQuotes(baseParams))
            await waitFor(() =>
                expect(result.current.quoteFailure).not.toBeNull(),
            )

            mockCreateQuotes.mockImplementation(() => new Promise(() => {}))
            act(() => result.current.reset())

            expect(result.current.quoteFailure).toBeNull()
        })

        it('is unsupported for a pair asset missing on the network, without a request', async () => {
            mockAssetsQueryResult = makeAssetsResult(['0'])

            const { result } = renderHook(() => useSwapQuotes(baseParams))

            await waitFor(() =>
                expect(result.current.quoteFailure).toEqual({
                    kind: 'unsupported',
                }),
            )
            expect(mockCreateQuotes).not.toHaveBeenCalled()
        })

        it('is unsupported for the 404 tombstone', async () => {
            mockCreateQuotes.mockRejectedValue({ response: { status: 404 } })

            const { result } = renderHook(() => useSwapQuotes(baseParams))

            await waitFor(() =>
                expect(result.current.quoteFailure).toEqual({
                    kind: 'unsupported',
                }),
            )
        })

        it('clears when the amount changes and the next request starts', async () => {
            mockCreateQuotes.mockRejectedValueOnce(
                routerRefusal(503, 'route_unavailable'),
            )
            mockCreateQuotes.mockImplementation(() => new Promise(() => {}))

            const { result, rerender } = renderHook(
                (props: typeof baseParams) => useSwapQuotes(props),
                { initialProps: baseParams },
            )
            await waitFor(() =>
                expect(result.current.quoteFailure).not.toBeNull(),
            )

            rerender({ ...baseParams, payAmount: new Decimal(2) })

            await waitFor(() =>
                expect(mockCreateQuotes).toHaveBeenCalledTimes(2),
            )
            expect(result.current.quoteFailure).toBeNull()
        })
    })

    it('does not resolve pair assets while quoting is disabled', () => {
        renderHook(() => useSwapQuotes({ ...baseParams, enabled: false }))

        expect(mockUseAssetsQuery).toHaveBeenCalledWith(
            expect.anything(),
            [],
            expect.objectContaining({ fetchMissing: true }),
        )
        expect(mockCreateQuotes).not.toHaveBeenCalled()
    })

    it('quotes again once the pair changes after a 404', async () => {
        mockCreateQuotes.mockRejectedValue({ response: { status: 404 } })

        const { rerender } = renderHook(
            (props: typeof baseParams) => useSwapQuotes(props),
            { initialProps: baseParams },
        )
        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))

        mockAssetsQueryResult = makeAssetsResult(['0', '999'])
        rerender({ ...baseParams, toAssetId: '999' })

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(2))
    })

    it('retries the same pair after a non-404 failure', async () => {
        mockCreateQuotes.mockRejectedValue({ response: { status: 500 } })

        const { rerender } = renderHook(
            (props: typeof baseParams) => useSwapQuotes(props),
            { initialProps: baseParams },
        )
        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))

        rerender({ ...baseParams, payAmount: new Decimal(2) })

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(2))
    })

    it('does not quote a pair with an asset missing on the active network', async () => {
        mockAssetsQueryResult = makeAssetsResult(['0'])

        const { result } = renderHook(() => useSwapQuotes(baseParams))

        await waitFor(() => expect(result.current.isQuoteError).toBe(true))
        expect(mockCreateQuotes).not.toHaveBeenCalled()
        expect(result.current.isQuoteFetching).toBe(false)
    })

    it('clears previously fetched quotes when the pair leaves the network', async () => {
        const quote = { quote_id: 'q1' }
        mockCreateQuotes.mockResolvedValue([quote])

        const { result, rerender } = renderHook(() => useSwapQuotes(baseParams))
        await waitFor(() => expect(result.current.allQuotes).toEqual([quote]))

        // Network switch: the persisted pair no longer resolves, so the old
        // quotes must not stay actionable next to the error banner.
        mockAssetsQueryResult = makeAssetsResult(['0'])
        rerender()

        await waitFor(() => expect(result.current.isQuoteError).toBe(true))
        expect(result.current.allQuotes).toEqual([])
        expect(result.current.quotedAmount).toBeNull()
    })

    it('waits for the pair check before quoting', () => {
        mockAssetsQueryResult = {
            data: new Map(),
            isPending: true,
            isFetched: false,
            isRefetching: false,
            isError: false,
        }

        const { result } = renderHook(() => useSwapQuotes(baseParams))

        expect(mockCreateQuotes).not.toHaveBeenCalled()
        expect(result.current.isQuoteError).toBe(false)
    })

    describe('a receive asset on another chain', () => {
        const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const

        beforeEach(() => {
            mockUseAssetsQuery.mockImplementation(
                (scope: { chainId: string }) =>
                    makeAssetsResult(
                        scope.chainId === 'ethereum' ? ['native'] : ['0'],
                    ),
            )
        })

        it('asks for the asset on its own chain, paid out to the receiving address', async () => {
            renderHook(() =>
                useSwapQuotes({
                    ...baseParams,
                    toAssetId: 'native',
                    toAssetScope: ETH,
                    destinationAddress: '0xETH',
                }),
            )

            await waitFor(() =>
                expect(mockCreateQuotes).toHaveBeenCalledTimes(1),
            )
            expect(mockUseAssetsQuery).toHaveBeenCalledWith(
                ETH,
                ['native'],
                expect.objectContaining({ fetchMissing: true }),
            )
            expect(mockCreateQuotes.mock.calls[0][0]).toMatchObject({
                sourceAsset: { ...baseParams.scope, assetId: '0' },
                destinationAsset: { ...ETH, assetId: 'native' },
                sourceAddress: 'SWAPPER',
                destinationAddress: '0xETH',
            })
        })

        it('waits for a receiving address', () => {
            renderHook(() =>
                useSwapQuotes({
                    ...baseParams,
                    toAssetId: 'native',
                    toAssetScope: ETH,
                    destinationAddress: null,
                }),
            )

            expect(mockCreateQuotes).not.toHaveBeenCalled()
        })
    })
})
