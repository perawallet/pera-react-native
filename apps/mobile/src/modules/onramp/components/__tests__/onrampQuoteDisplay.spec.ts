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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { RampQuote } from '@perawallet/wallet-core-onramp'
import { getOnrampProviderName } from '../onrampQuoteDisplay'

const quote = (overrides: Partial<RampQuote>): RampQuote => ({
    kind: 'meld',
    quoteId: 'quote-1',
    provider: 'BANXA',
    paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
    sourceAmount: new Decimal(100),
    destinationAmount: new Decimal(500),
    sourceValueInUsd: null,
    destinationValueInUsd: null,
    ...overrides,
})

describe('getOnrampProviderName', () => {
    it('maps a Meld provider id to its display name', () => {
        expect(getOnrampProviderName(quote({ provider: 'COINBASEPAY' }))).toBe(
            'Coinbase Pay',
        )
    })

    it('falls back to the raw id for a Meld provider it has no name for', () => {
        expect(getOnrampProviderName(quote({ provider: 'NEWPROVIDER' }))).toBe(
            'NEWPROVIDER',
        )
    })

    it('names a deposit quote Exodus', () => {
        expect(
            getOnrampProviderName(quote({ kind: 'xo', provider: 'XO' })),
        ).toBe('Exodus')
    })
})
