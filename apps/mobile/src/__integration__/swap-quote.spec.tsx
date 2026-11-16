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
// The swap quote pipeline: `useCreateQuotesMutation` POSTs the request to the
// router's quotes route and maps each offer back onto this wallet's chains.
//
// Stays at the hook boundary so the assertion is on network -> schema ->
// domain shape, not on SwapScreen's form and debounce flow, which is a
// separate target.

import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'

import { http, HttpResponse, server } from '@test-utils/msw-server'
import { createQueryClientWrapper } from '@test-utils/render'
import { mockCreateSwapQuotes } from '@perawallet/wallet-core-swaps/test-handlers'
import {
    SwapQuoteMismatchError,
    swapQuoteFailureOf,
    useCreateQuotesMutation,
    type SwapQuoteRequest,
} from '@perawallet/wallet-core-swaps'

const SWAPPER_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const MAINNET = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
const ALGO_ID = `${MAINNET}/asa:0`
const USDC_ID = `${MAINNET}/asa:31566704`

const REQUEST: SwapQuoteRequest = {
    sourceAsset: { chainId: 'algorand', networkId: 'mainnet', assetId: '0' },
    destinationAsset: {
        chainId: 'algorand',
        networkId: 'mainnet',
        assetId: '31566704',
    },
    sourceAmount: new Decimal('10000000'),
    sourceAddress: SWAPPER_ADDRESS,
    destinationAddress: SWAPPER_ADDRESS,
    slippage: '1',
}

const routerAsset = (
    assetId: string,
    unitName: string,
    name: string,
): {
    asset_id: string
    name: string
    unit_name: string
    fraction_decimals: number
    logo: null
    verification_tier: string
    cross_chain_asset_group: null
} => ({
    asset_id: assetId,
    name,
    unit_name: unitName,
    fraction_decimals: 6,
    logo: null,
    verification_tier: 'verified',
    cross_chain_asset_group: null,
})

const offer = (
    quoteId: string,
    provider: string,
    destinationAmount: string,
    sourceAmount = '10000000',
) => ({
    quote_id: quoteId,
    aggregator: 'pera',
    provider,
    source_asset: routerAsset(ALGO_ID, 'ALGO', 'Algorand'),
    destination_asset: routerAsset(USDC_ID, 'USDC', 'USD Coin'),
    source_amount: sourceAmount,
    destination_amount_expected: destinationAmount,
    destination_amount_minimum: '2920500',
    source_amount_usd_value: '3.00',
    destination_amount_usd_value: '2.95',
    fees: [
        {
            kind: 'pera' as const,
            asset_id: ALGO_ID,
            amount: '15000',
            usd_value: '0.0045',
        },
    ],
    funding_method: 'wallet',
    expires_at: null,
    extras: { price_impact: '0.1' },
})

const requestQuotes = () => {
    const { result } = renderHook(() => useCreateQuotesMutation(), {
        wrapper: createQueryClientWrapper(),
    })
    result.current.mutate(REQUEST)
    return result
}

describe('Flow: Swap quote (router)', () => {
    it('Given the router returns two offers, when the user requests a quote, then both arrive on Algorand with their provider, minimum, fees and price impact', async () => {
        let body: unknown = null
        server.use(
            // Listed first so it sees the request, then falls through.
            http.post('*/api/v4/swap/quotes/', async ({ request }) => {
                body = await request.clone().json()
                return undefined
            }),
            mockCreateSwapQuotes({
                response: {
                    aggregator: 'pera',
                    results: [
                        offer('quote-tinyman-1', 'tinyman', '2950000'),
                        offer('quote-pact-1', 'pact', '2900000'),
                    ],
                },
            }),
        )

        const result = requestQuotes()

        await waitFor(() => expect(result.current.isSuccess).toBe(true), {
            timeout: 5000,
        })

        expect(body).toEqual({
            source_asset_id: ALGO_ID,
            destination_asset_id: USDC_ID,
            source_amount: '10000000',
            source_account: `${MAINNET}:${SWAPPER_ADDRESS}`,
            destination_account: `${MAINNET}:${SWAPPER_ADDRESS}`,
            slippage: '1',
        })

        const quotes = result.current.data!
        expect(quotes.map(q => q.provider)).toEqual(['tinyman', 'pact'])
        const [tinyman] = quotes
        expect(tinyman.quoteId).toBe('quote-tinyman-1')
        expect(tinyman.routeKind).toBe('single-chain')
        expect(tinyman.assetIn.ref).toEqual(REQUEST.sourceAsset)
        expect(tinyman.assetOut.ref).toEqual(REQUEST.destinationAsset)
        expect(tinyman.assetOut.unitName).toBe('USDC')
        expect(tinyman.amountOut.toString()).toBe('2950000')
        expect(tinyman.minimumAmountOut?.toString()).toBe('2920500')
        expect(tinyman.priceImpact?.toString()).toBe('0.1')
        expect(tinyman.fees).toEqual([
            {
                kind: 'pera',
                asset: REQUEST.sourceAsset,
                amount: new Decimal('15000'),
                usdValue: '0.0045',
            },
        ])
        expect(tinyman.request).toEqual(REQUEST)
    })

    it('Given the router finds no route, when the user requests a quote, then the mutation succeeds with an empty list (the UI surfaces "no route")', async () => {
        server.use(mockCreateSwapQuotes({ response: { results: [] } }))

        const result = requestQuotes()

        await waitFor(() => expect(result.current.isSuccess).toBe(true), {
            timeout: 5000,
        })
        expect(result.current.data).toEqual([])
    })

    it('Given an offer for a different amount than asked, when the quotes arrive, then the mutation refuses them as a mismatch', async () => {
        server.use(
            mockCreateSwapQuotes({
                response: {
                    results: [
                        offer('quote-1', 'tinyman', '2950000', '500000000'),
                    ],
                },
            }),
        )

        const result = requestQuotes()

        await waitFor(() => expect(result.current.isError).toBe(true), {
            timeout: 5000,
        })
        expect(result.current.error).toBeInstanceOf(SwapQuoteMismatchError)
    })

    it('Given the router answers with an error body, when the user requests a quote, then the mutation surfaces the error without throwing', async () => {
        server.use(
            mockCreateSwapQuotes({
                response: {
                    error: 'Pair not supported',
                    code: 'pair_not_supported',
                },
                status: 422,
            }),
        )

        const result = requestQuotes()

        await waitFor(() => expect(result.current.isError).toBe(true), {
            timeout: 5000,
        })
        expect(swapQuoteFailureOf(result.current.error)).toEqual({
            kind: 'no-route',
        })
    })

    it('Given the router says the amount is below its minimum, when the user requests a quote, then the failure carries that minimum in base units', async () => {
        server.use(
            mockCreateSwapQuotes({
                response: {
                    error: 'Amount too low',
                    code: 'amount_too_low',
                    source_amount_minimum: '2000',
                },
                status: 422,
            }),
        )

        const result = requestQuotes()

        await waitFor(() => expect(result.current.isError).toBe(true), {
            timeout: 5000,
        })
        expect(swapQuoteFailureOf(result.current.error)).toEqual({
            kind: 'amount-too-low',
            minimum: new Decimal(2000),
        })
    })

    it('Given the router has the route switched off, when the user requests a quote, then the failure is retryable', async () => {
        server.use(
            mockCreateSwapQuotes({
                response: {
                    error: 'Route unavailable',
                    code: 'route_unavailable',
                },
                status: 503,
            }),
        )

        const result = requestQuotes()

        await waitFor(() => expect(result.current.isError).toBe(true), {
            timeout: 5000,
        })
        expect(swapQuoteFailureOf(result.current.error)).toEqual({
            kind: 'unavailable',
        })
    })

    it('Given a transport failure, when the quote mutation runs, then the error surfaces through TanStack Query rather than crashing the consumer', async () => {
        server.use(
            http.post('*/api/v4/swap/quotes/', () => HttpResponse.error()),
        )

        const result = requestQuotes()

        await waitFor(() => expect(result.current.isError).toBe(true), {
            timeout: 5000,
        })
        expect(result.current.error).toBeTruthy()
    })
})
