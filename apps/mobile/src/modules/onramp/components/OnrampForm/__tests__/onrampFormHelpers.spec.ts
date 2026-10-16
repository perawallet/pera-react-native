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
import type { XoQuote } from '@perawallet/wallet-core-onramp'
import { getXoLimitViolation } from '../onrampFormHelpers'

const xoQuote: XoQuote = {
    kind: 'xo',
    quoteId: 'xo-1',
    paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
    amount: { assetId: 'ALGO', value: new Decimal(5) },
    min: { assetId: 'USD', value: new Decimal('10.00') },
    max: { assetId: 'USD', value: new Decimal(5000) },
    minerFee: { assetId: 'ALGO', value: new Decimal(1) },
    expiry: Date.now() + 60_000,
    pairId: 'pair-xo',
    providerQuoteId: 'provider-quote-1',
}

describe('getXoLimitViolation', () => {
    it('reports an amount below the minimum with the minimum as text', () => {
        expect(getXoLimitViolation(xoQuote, new Decimal('9.99'))).toEqual({
            type: 'below',
            min: '10',
        })
    })

    it('reports an amount above the maximum with the maximum as text', () => {
        expect(getXoLimitViolation(xoQuote, new Decimal(5001))).toEqual({
            type: 'above',
            max: '5000',
        })
    })

    it('returns null for an amount within the limits, bounds included', () => {
        expect(getXoLimitViolation(xoQuote, new Decimal(10))).toBeNull()
        expect(getXoLimitViolation(xoQuote, new Decimal(5000))).toBeNull()
    })

    it('returns null when no amount is entered', () => {
        expect(getXoLimitViolation(xoQuote, null)).toBeNull()
    })
})
