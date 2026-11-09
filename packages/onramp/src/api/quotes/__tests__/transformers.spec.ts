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

import { depositOffer, meldOffer } from '../../../__tests__/routerFixtures'
import { transformRampOffer } from '../transformers'

const DECIMALS = { source: 2, destination: 6 }

describe('transformRampOffer', () => {
    it('maps a Meld offer with its provider and a named payment method', () => {
        const quote = transformRampOffer(meldOffer(), DECIMALS)

        expect(quote).toMatchObject({
            kind: 'meld',
            quoteId: 'quote-1',
            provider: 'BANXA',
            paymentMethod: {
                id: 'CREDIT_DEBIT_CARD',
                name: 'Credit/Debit Card',
                logo: null,
            },
        })
    })

    it('humanises a payment method it has no name for', () => {
        const quote = transformRampOffer(
            meldOffer({ extras: { payment_method: 'ONLINE_BANKING' } }),
            DECIMALS,
        )

        expect(quote?.paymentMethod).toEqual({
            id: 'ONLINE_BANKING',
            name: 'Online Banking',
            logo: null,
        })
    })

    it('converts base units to display units on each side', () => {
        const quote = transformRampOffer(meldOffer(), DECIMALS)

        expect(quote?.sourceAmount.toString()).toBe('600')
        expect(quote?.destinationAmount.toString()).toBe('999.5')
    })

    it('reads the USD values, null when the router sends none', () => {
        const priced = transformRampOffer(meldOffer(), DECIMALS)
        const unpriced = transformRampOffer(
            meldOffer({
                source_amount_usd_value: null,
                destination_amount_usd_value: null,
            }),
            DECIMALS,
        )

        expect(priced?.sourceValueInUsd?.toString()).toBe('600')
        expect(priced?.destinationValueInUsd?.toString()).toBe('480')
        expect(unpriced?.sourceValueInUsd).toBeNull()
        expect(unpriced?.destinationValueInUsd).toBeNull()
    })

    it('maps an external deposit offer to XO with the CRYPTO payment method', () => {
        const quote = transformRampOffer(depositOffer(), {
            source: 8,
            destination: 6,
        })

        expect(quote).toMatchObject({
            kind: 'xo',
            quoteId: 'quote-xo',
            provider: 'XO',
            paymentMethod: { id: 'CRYPTO', name: '', logo: null },
        })
        expect(quote?.sourceAmount.toString()).toBe('0.5')
        expect(quote?.destinationAmount.toString()).toBe('950.5')
    })

    it('drops an offer the wallet would have to sign', () => {
        expect(
            transformRampOffer(
                meldOffer({ funding_method: 'wallet_transaction' }),
                DECIMALS,
            ),
        ).toBeNull()
    })
})
