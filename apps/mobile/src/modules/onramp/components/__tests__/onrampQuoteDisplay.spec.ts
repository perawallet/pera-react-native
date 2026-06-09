/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import type { MeldQuote, XoQuote } from '@perawallet/wallet-core-onramp'
import {
    getOnrampDestinationCurrency,
    getOnrampFeeCurrency,
} from '../onrampQuoteDisplay'

const meldQuote: MeldQuote = {
    kind: 'meld',
    quoteId: 'meld-1',
    paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
    sourceAmount: new Decimal(100),
    destinationAmount: new Decimal(500),
    sourceCurrencyCode: 'USD',
    destinationCurrencyCode: 'EUR',
    totalFee: new Decimal(1),
    networkFee: null,
    transactionFee: new Decimal(1),
    exchangeRate: new Decimal(5),
    paymentMethodType: 'CARD',
    serviceProvider: 'STRIPE',
    institutionName: null,
    lowKyc: false,
}

const xoQuote: XoQuote = {
    kind: 'xo',
    quoteId: 'xo-1',
    paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
    amount: { assetId: 'ALGO', value: new Decimal(5) },
    min: { assetId: 'USD', value: new Decimal(10) },
    max: { assetId: 'USD', value: new Decimal(5000) },
    minerFee: { assetId: 'USDC', value: new Decimal(1) },
    expiry: Date.now() + 60_000,
    pairId: 'pair-xo',
    providerQuoteId: 'provider-quote-1',
}

describe('getOnrampDestinationCurrency', () => {
    it('returns the destination currency code for Meld quotes', () => {
        expect(getOnrampDestinationCurrency(meldQuote)).toBe('EUR')
    })

    it('returns the destination asset id for XO quotes', () => {
        expect(getOnrampDestinationCurrency(xoQuote)).toBe('ALGO')
    })
})

describe('getOnrampFeeCurrency', () => {
    it('returns the source currency code for Meld quotes', () => {
        expect(getOnrampFeeCurrency(meldQuote)).toBe('USD')
    })

    it('returns the miner-fee asset id for XO quotes', () => {
        expect(getOnrampFeeCurrency(xoQuote)).toBe('USDC')
    })
})
