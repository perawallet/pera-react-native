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

import { transformRampPair } from '../transformers'
import type { RampPairApiResponse } from '../schema'

const buildPair = (
    overrides?: Partial<RampPairApiResponse>,
): RampPairApiResponse => ({
    id: 'pair-1',
    source_token: {
        id: 'usd',
        symbol: 'USD',
        name: 'US Dollar',
        fraction_decimals: 6,
        logo: 'https://example.com/usd.png',
        network: { id: 'fiat', name: 'Fiat', logo: null },
        price_in_usd: '1',
        extra: { country_code: 'US' },
    },
    destination_token: {
        id: 'algo',
        symbol: 'ALGO',
        name: 'Algorand',
        fraction_decimals: 6,
        logo: null,
        network: { id: 'algorand', name: 'Algorand', logo: null },
        price_in_usd: null,
        extra: {},
    },
    provider: {
        id: 'meld',
        payment_types: ['CARD', 'BANK'],
        limits: { min_source_amount: '10', max_source_amount: '5000' },
    },
    ...overrides,
})

describe('pairs transformers', () => {
    describe('transformRampPair', () => {
        it('maps source token fraction_decimals to fractionDecimals', () => {
            const result = transformRampPair(buildPair())

            expect(result.sourceToken.fractionDecimals).toBe(6)
        })

        it('maps provider limit amounts to Decimal instances', () => {
            const result = transformRampPair(buildPair())

            expect(result.provider.limits).not.toBeNull()
            expect(result.provider.limits?.minSourceAmount).toBeInstanceOf(
                Decimal,
            )
            expect(
                result.provider.limits?.minSourceAmount.equals(
                    new Decimal('10'),
                ),
            ).toBe(true)
            expect(
                result.provider.limits?.maxSourceAmount.equals(
                    new Decimal('5000'),
                ),
            ).toBe(true)
        })

        it('maps null limits to null', () => {
            const result = transformRampPair(
                buildPair({
                    provider: {
                        id: 'xo',
                        payment_types: [],
                        limits: null,
                    },
                }),
            )

            expect(result.provider.limits).toBeNull()
        })

        it('maps null price_in_usd to null priceInUsd', () => {
            const result = transformRampPair(buildPair())

            expect(result.destinationToken.priceInUsd).toBeNull()
        })

        it('maps non-null price_in_usd to a Decimal', () => {
            const result = transformRampPair(buildPair())

            expect(result.sourceToken.priceInUsd).toBeInstanceOf(Decimal)
            expect(
                result.sourceToken.priceInUsd?.equals(new Decimal('1')),
            ).toBe(true)
        })

        it('maps extra.country_code to optional countryCode', () => {
            const result = transformRampPair(buildPair())

            expect(result.sourceToken.countryCode).toBe('US')
            expect(result.destinationToken.countryCode).toBeUndefined()
        })

        it('maps network fields and preserves null logo', () => {
            const result = transformRampPair(buildPair())

            expect(result.destinationToken.network).toEqual({
                id: 'algorand',
                name: 'Algorand',
                logo: null,
            })
        })

        it('maps top-level pair fields and provider payment types', () => {
            const result = transformRampPair(buildPair())

            expect(result.id).toBe('pair-1')
            expect(result.provider.id).toBe('meld')
            expect(result.provider.paymentTypes).toEqual(['CARD', 'BANK'])
        })
    })
})
