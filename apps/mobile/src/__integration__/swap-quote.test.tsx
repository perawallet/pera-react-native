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

// The swap quote pipeline: `useCreateQuotesMutation` ensures the providers
// query, then POSTs to /v2/dex-swap/quotes/ for SwapQuote[].
//
// Stays at the hook boundary so the assertion is on network -> schema ->
// domain shape, not on SwapScreen's form and debounce flow, which is a
// separate target.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import {
    mockCreateQuotes,
    mockSwapProviders,
} from '@perawallet/wallet-core-swaps/test-handlers'
import { useCreateQuotesMutation } from '@perawallet/wallet-core-swaps'

const SLOW_TEST_TIMEOUT_MS = 30_000

const SWAPPER_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

// Two providers — Tinyman and Pact — so we can confirm the mutation's
// providerDisplayName join (`providers.find(p => p.name === ...)`)
// returns a verifiable label, not just the raw provider string.
const PROVIDERS = {
    results: [
        {
            name: 'tinyman_v2',
            display_name: 'Tinyman v2',
            icon_url: 'https://cdn.example/tinyman.png',
        },
        {
            name: 'pact',
            display_name: 'Pact',
            icon_url: 'https://cdn.example/pact.png',
        },
    ],
}

// Two competing quotes — Tinyman with a better rate, Pact with a worse
// one — so the test asserts both routes propagate (the UI ranks them
// by amountOut/in; the hook surface returns the unsorted list).
const ALGO_USDC_QUOTES = {
    results: [
        {
            id: 1,
            quote_id_str: 'quote-tinyman-1',
            provider: 'tinyman_v2',
            swap_type: 'fixed-input' as const,
            swapper_address: SWAPPER_ADDRESS,
            device: 1,
            asset_in: {
                asset_id: 0,
                logo: null,
                name: 'Algorand',
                unit_name: 'ALGO',
                total: '10000000000',
                fraction_decimals: 6,
                verification_tier: 'verified' as const,
                usd_value: '0.30',
            },
            asset_out: {
                asset_id: 31_566_704,
                logo: null,
                name: 'USD Coin',
                unit_name: 'USDC',
                total: '18446744073709551615',
                fraction_decimals: 6,
                verification_tier: 'verified' as const,
                usd_value: '1.00',
            },
            amount_in: '10000000', // 10 ALGO in micro-ALGO
            amount_in_with_slippage: '10000000',
            amount_in_usd_value: '3.00',
            amount_out: '2950000', // 2.95 USDC at this rate
            amount_out_with_slippage: '2920500', // 1% slippage
            amount_out_usd_value: '2.95',
            slippage: '0.01',
            price: '0.295',
            price_impact: '0.001',
            pera_fee_amount: '15000',
            pera_fee_asset: {
                asset_id: 0,
                logo: null,
                name: 'Algorand',
                unit_name: 'ALGO',
                total: '10000000000',
                fraction_decimals: 6,
                verification_tier: 'verified' as const,
                usd_value: '0.30',
            },
            transaction_fees: '4000',
        },
        {
            id: 2,
            quote_id_str: 'quote-pact-1',
            provider: 'pact',
            swap_type: 'fixed-input' as const,
            swapper_address: SWAPPER_ADDRESS,
            device: 1,
            asset_in: {
                asset_id: 0,
                logo: null,
                name: 'Algorand',
                unit_name: 'ALGO',
                total: '10000000000',
                fraction_decimals: 6,
                verification_tier: 'verified' as const,
                usd_value: '0.30',
            },
            asset_out: {
                asset_id: 31_566_704,
                logo: null,
                name: 'USD Coin',
                unit_name: 'USDC',
                total: '18446744073709551615',
                fraction_decimals: 6,
                verification_tier: 'verified' as const,
                usd_value: '1.00',
            },
            amount_in: '10000000',
            amount_in_with_slippage: '10000000',
            amount_in_usd_value: '3.00',
            amount_out: '2900000', // worse rate than tinyman
            amount_out_with_slippage: '2871000',
            amount_out_usd_value: '2.90',
            slippage: '0.01',
            price: '0.290',
            price_impact: '0.002',
            pera_fee_amount: '15000',
            pera_fee_asset: {
                asset_id: 0,
                logo: null,
                name: 'Algorand',
                unit_name: 'ALGO',
                total: '10000000000',
                fraction_decimals: 6,
                verification_tier: 'verified' as const,
                usd_value: '0.30',
            },
            transaction_fees: '4000',
        },
    ],
}

const buildWrapper = () => {
    const queryClient = createTestQueryClient()
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

describe('Flow: Swap quote (Pera DEX aggregator)', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        // Providers must be available before the quote mutation runs —
        // the mutationFn reads them via `ensureQueryData` so it can
        // join `display_name` onto each returned quote.
        server.use(mockSwapProviders({ response: PROVIDERS }))
    })

    it(
        'Given the providers list and the quotes endpoint return data, when the user requests a swap quote, then the mutation resolves with both quotes including provider display names, slippage, and minimum-received amounts',
        async () => {
            server.use(mockCreateQuotes({ response: ALGO_USDC_QUOTES }))

            const { result } = renderHook(() => useCreateQuotesMutation(), {
                wrapper: buildWrapper(),
            })

            // Drive the mutation the way `useSwapForm` does after the
            // user enters an amount and the debounce settles.
            result.current.mutate({
                swapper_address: SWAPPER_ADDRESS,
                swap_type: 'fixed-input',
                asset_in_id: 0,
                asset_out_id: 31_566_704,
                amount: '10000000',
                slippage: '0.01',
            })

            await waitFor(
                () => {
                    expect(result.current.isSuccess).toBe(true)
                },
                { timeout: 5000 },
            )

            const quotes = result.current.data!
            expect(quotes).toHaveLength(2)

            // The Tinyman quote retains its provider name AND picks up
            // the display name from the providers join. Without the
            // providers fetch firing first, providerDisplayName would be
            // undefined.
            const tinyman = quotes.find(q => q.provider === 'tinyman_v2')!
            expect(tinyman).toBeDefined()
            expect(tinyman.providerDisplayName).toBe('Tinyman v2')

            const pact = quotes.find(q => q.provider === 'pact')!
            expect(pact).toBeDefined()
            expect(pact.providerDisplayName).toBe('Pact')

            // String → Decimal coercions land on the right fields. UI
            // displays `amountOutWithSlippage` as the "minimum received"
            // line; production reads that as a Decimal so it can be
            // formatted at the asset's decimal precision.
            expect(tinyman.amountOut?.toString()).toBe('2950000')
            expect(tinyman.amountOutWithSlippage?.toString()).toBe('2920500')
            expect(tinyman.slippage?.toString()).toBe('0.01')
            expect(tinyman.priceImpact?.toString()).toBe('0.001')
            expect(tinyman.peraFeeAmount?.toString()).toBe('15000')

            // Asset metadata round-trips through `transformDexSwapAsset`
            // — verification_tier survives so the UI can decorate
            // suspicious assets.
            expect(tinyman.assetIn.verificationTier).toBe('verified')
            expect(tinyman.assetOut.unitName).toBe('USDC')
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the quotes endpoint returns an empty list, when the user requests a quote, then the mutation succeeds with an empty array (the UI surfaces "no route")',
        async () => {
            server.use(mockCreateQuotes({ response: { results: [] } }))

            const { result } = renderHook(() => useCreateQuotesMutation(), {
                wrapper: buildWrapper(),
            })

            result.current.mutate({
                swapper_address: SWAPPER_ADDRESS,
                swap_type: 'fixed-input',
                asset_in_id: 0,
                asset_out_id: 31_566_704,
                amount: '10000000',
                slippage: '0.01',
            })

            await waitFor(
                () => {
                    expect(result.current.isSuccess).toBe(true)
                },
                { timeout: 5000 },
            )
            // Empty results → empty array, not an error. The UI uses
            // `length === 0` as the gate for the "no liquidity" empty
            // state; an undefined here would crash the screen.
            expect(result.current.data).toEqual([])
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the quotes endpoint returns an HTTP error, when the user requests a quote, then the mutation transitions to error state without throwing',
        async () => {
            server.use(
                mockCreateQuotes({
                    response: { results: [] },
                    status: 500,
                }),
            )

            const { result } = renderHook(() => useCreateQuotesMutation(), {
                wrapper: buildWrapper(),
            })

            result.current.mutate({
                swapper_address: SWAPPER_ADDRESS,
                swap_type: 'fixed-input',
                asset_in_id: 0,
                asset_out_id: 31_566_704,
                amount: '10000000',
                slippage: '0.01',
            })

            // The hook sets `throwOnError: false` so the consumer sees
            // an error state instead of an unhandled rejection. This is
            // the contract `useSwapForm` relies on when surfacing
            // failures via toast.
            await waitFor(
                () => {
                    expect(result.current.isError).toBe(true)
                },
                { timeout: 5000 },
            )
            expect(result.current.error).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
