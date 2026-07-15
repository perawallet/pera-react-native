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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'

import {
    transformRampHistoryItem,
    transformRampHistoryPage,
} from '../transformers'
import { rampHistoryPageSchema } from '../schema'
import type {
    RampHistoryItemApiResponse,
    RampHistoryPageApiResponse,
} from '../schema'

const buildPair = (): RampHistoryItemApiResponse['ramp_quote']['pair'] => ({
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
})

const buildMeldHistoryItem = (
    overrides?: Partial<RampHistoryItemApiResponse>,
): RampHistoryItemApiResponse => ({
    id: 'history-meld-1',
    creation_datetime: '2025-06-01T10:00:00Z',
    status: 'completed',
    ramp_quote: {
        id: 'quote-meld-1',
        provider: 'meld',
        payment_method: { id: 'card', logo: null, name: 'Credit Card' },
        pair: buildPair(),
        provider_responses: {
            quotes_response: {
                sourceAmount: 100,
                destinationAmount: 475.5,
                sourceCurrencyCode: 'USD',
                destinationCurrencyCode: 'ALGO',
                serviceProvider: 'TRANSAK',
            },
            order_response: { id: 'meld-order-1' },
        },
    },
    ...overrides,
})

const buildXoHistoryItem = (
    overrides?: Partial<RampHistoryItemApiResponse>,
): RampHistoryItemApiResponse => ({
    id: 'history-xo-1',
    creation_datetime: '2025-06-02T11:00:00Z',
    status: 'pending',
    ramp_quote: {
        id: 'quote-xo-1',
        provider: 'xo',
        payment_method: { id: 'crypto', logo: null, name: 'Crypto' },
        pair: buildPair(),
        provider_responses: {
            order_response: {
                amount: { assetId: 'btc', value: '0.005' },
                toAmount: { assetId: '0', value: 123.456 },
                payInAddress: 'PAYIN',
                toAddress: 'TOADDR',
                status: 'waiting',
                id: 'xo-order-1',
            },
        },
    },
    ...overrides,
})

describe('history transformers', () => {
    it('flattens a Meld history item into Decimal amounts and currency codes', () => {
        const result = transformRampHistoryItem(buildMeldHistoryItem())

        expect(result.id).toBe('history-meld-1')
        expect(result.status).toBe('completed')
        expect(result.creationDatetime).toBe('2025-06-01T10:00:00Z')
        expect(result.provider).toBe('meld')
        expect(result.sourceAmount).toBeInstanceOf(Decimal)
        expect(result.sourceAmount?.equals(new Decimal(100))).toBe(true)
        expect(result.destinationAmount?.equals(new Decimal('475.5'))).toBe(
            true,
        )
        expect(result.sourceCurrencyCode).toBe('USD')
        expect(result.destinationCurrencyCode).toBe('ALGO')
        expect(result.pair.id).toBe('pair-1')
        expect(result.paymentMethod.name).toBe('Credit Card')
    })

    it('derives XO history amounts as Decimal with null currency codes', () => {
        const result = transformRampHistoryItem(buildXoHistoryItem())

        expect(result.provider).toBe('xo')
        expect(result.status).toBe('pending')
        expect(result.sourceAmount?.equals(new Decimal('0.005'))).toBe(true)
        expect(result.destinationAmount?.equals(new Decimal('123.456'))).toBe(
            true,
        )
        expect(result.sourceCurrencyCode).toBeNull()
        expect(result.destinationCurrencyCode).toBeNull()
        expect(result.pair.destinationToken.symbol).toBe('ALGO')
        expect(result.paymentMethod.name).toBe('Crypto')
        // XO pay-in fields are surfaced so the order-details sheet can show
        // the QR/address + cancel for a pending order. swapOrderId is the
        // item's top-level (Pera) id — what the cancel endpoint expects — not
        // the provider's order_response.id.
        expect(result.swapOrderId).toBe('history-xo-1')
        expect(result.payInAddress).toBe('PAYIN')
        expect(result.toAddress).toBe('TOADDR')
    })

    it('leaves XO pay-in fields undefined for a Meld item', () => {
        const result = transformRampHistoryItem(buildMeldHistoryItem())

        expect(result.swapOrderId).toBeUndefined()
        expect(result.payInAddress).toBeUndefined()
        expect(result.toAddress).toBeUndefined()
    })

    it('maps page count/next/previous and an array of mixed items', () => {
        const page: RampHistoryPageApiResponse = {
            count: 2,
            next: 'https://mainnet.staging.api.perawallet.app/v1/ramp/history/d/a/?offset=10',
            previous: null,
            results: [buildMeldHistoryItem(), buildXoHistoryItem()],
        }

        const result = transformRampHistoryPage(page)

        expect(result.count).toBe(2)
        expect(result.next).toBe(
            'https://mainnet.staging.api.perawallet.app/v1/ramp/history/d/a/?offset=10',
        )
        expect(result.previous).toBeNull()
        expect(result.results).toHaveLength(2)
        expect(result.results[0].provider).toBe('meld')
        expect(result.results[1].provider).toBe('xo')
        expect(result.results[1].sourceCurrencyCode).toBeNull()
    })

    it('tolerates a history pair without a provider (falls back to quote provider)', () => {
        const base = buildMeldHistoryItem()
        const item: RampHistoryItemApiResponse = {
            ...base,
            ramp_quote: {
                ...base.ramp_quote,
                pair: { ...base.ramp_quote.pair, provider: undefined },
            },
        }

        const result = transformRampHistoryItem(item)

        expect(result.pair.provider.id).toBe('meld')
        expect(result.pair.provider.limits).toBeNull()
    })

    it('tolerates a response without count or pagination links', () => {
        // The live API omits `count` (and may omit next/previous) — the page
        // schema must accept it and the transformer must not crash.
        const parsed = rampHistoryPageSchema.parse({
            results: [buildMeldHistoryItem()],
        })

        const result = transformRampHistoryPage(parsed)

        expect(result.count).toBe(1)
        expect(result.next).toBeNull()
        expect(result.previous).toBeNull()
        expect(result.results).toHaveLength(1)
    })
})
