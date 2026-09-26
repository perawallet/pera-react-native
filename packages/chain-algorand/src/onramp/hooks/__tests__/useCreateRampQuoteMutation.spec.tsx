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
import { Decimal } from 'decimal.js'
import { setupServer } from 'msw/node'
import React from 'react'

import { mockCreateRampQuote } from '../../test-handlers'
import type { RampQuoteApiResponse } from '../../api/quotes/schema'
import { useCreateRampQuoteMutation } from '../useCreateRampQuoteMutation'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const xoQuote: RampQuoteApiResponse = {
    quote_id: 'quote-1',
    payment_method: { id: 'crypto', logo: null, name: 'Crypto' },
    provider_response: {
        amount: { assetId: '0', value: 100 },
        expiry: 60,
        id: 'provider-quote-1',
        max: { assetId: '0', value: 1000 },
        min: { assetId: '0', value: 1 },
        minerFee: { assetId: '0', value: 1 },
        pairId: 'pair-1',
    },
}

// Mirrors the staging Meld payload (Mercuryo): lowKyc and several other
// provider fields arrive as null.
const meldQuote: RampQuoteApiResponse = {
    quote_id: 'meld_3b03fdf4',
    payment_method: {
        id: 'CREDIT_DEBIT_CARD',
        logo: null,
        name: 'Credit Debit Card',
    },
    provider_response: {
        transactionType: 'CRYPTO_PURCHASE',
        sourceAmount: 100.0,
        sourceAmountWithoutFees: 93.88,
        fiatAmountWithoutFees: 93.88,
        destinationAmountWithoutFees: null,
        sourceCurrencyCode: 'USD',
        countryCode: 'TR',
        totalFee: 6.12,
        networkFee: null,
        transactionFee: 6.12,
        destinationAmount: 1050.695113,
        destinationCurrencyCode: 'ALGO',
        exchangeRate: 0.09517508815,
        paymentMethodType: 'CREDIT_DEBIT_CARD',
        customerScore: 24.91,
        serviceProvider: 'MERCURYO',
        institutionName: null,
        lowKyc: null,
        partnerFee: null,
        isNativeAvailable: false,
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

describe('onramp/useCreateRampQuoteMutation', () => {
    test('returns transformed quotes from mutateAsync', async () => {
        server.use(mockCreateRampQuote({ response: [xoQuote] }))

        const { result } = renderHook(() => useCreateRampQuoteMutation(), {
            wrapper: createWrapper(),
        })

        const quotes = await result.current.mutateAsync({
            pair: 'pair-1',
            destinationAddress: 'DEST_ADDRESS',
            sourceAmount: 100,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(quotes).toHaveLength(1)
        expect(quotes[0].quoteId).toBe('quote-1')
        expect(quotes[0].kind).toBe('xo')
    })

    test('accepts a Meld quote whose nullable provider fields are null', async () => {
        server.use(mockCreateRampQuote({ response: [meldQuote] }))

        const { result } = renderHook(() => useCreateRampQuoteMutation(), {
            wrapper: createWrapper(),
        })

        const quotes = await result.current.mutateAsync({
            pair: 'USD__ALGO',
            destinationAddress: 'DEST_ADDRESS',
            sourceAmount: 100,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(quotes).toHaveLength(1)
        const quote = quotes[0]
        if (quote.kind !== 'meld') throw new Error('expected meld quote')
        expect(quote.lowKyc).toBeNull()
        expect(quote.networkFee).toBeNull()
        expect(quote.institutionName).toBeNull()
        expect(quote.destinationAmount.equals(new Decimal('1050.695113'))).toBe(
            true,
        )
    })
})
