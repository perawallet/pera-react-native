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

import { transformRampOrder } from '../transformers'
import type { RampOrderApiResponse } from '../schema'

const buildXoOrder = (
    overrides?: Partial<RampOrderApiResponse>,
): RampOrderApiResponse => ({
    swap_order_id: 'order-xo-1',
    xo: {
        pay_in_address: 'PAYIN1234',
        source_amount: '12.5',
        provider_response: {
            payInAddress: 'PAYIN1234',
            payInAddressTag: 'tag-123',
            toAddress: 'TOADDR5678',
            status: 'pending',
        },
    },
    meld: null,
    ...overrides,
})

const buildMeldOrder = (
    overrides?: Partial<RampOrderApiResponse>,
): RampOrderApiResponse => ({
    swap_order_id: 'order-meld-1',
    xo: null,
    meld: {
        provider_response: {
            id: 'meld-1',
            externalSessionId: 'sess-1',
            widgetUrl: 'https://widget.example.com/session',
            serviceProviderWidgetUrl: 'https://sp.example.com',
            token: 'tok-1',
        },
    },
    ...overrides,
})

describe('orders transformers', () => {
    describe('transformRampOrder (XO)', () => {
        it('detects the XO shape when xo is present', () => {
            const result = transformRampOrder(buildXoOrder())

            expect(result.kind).toBe('xo')
        })

        it('maps swapOrderId and payInAddress', () => {
            const result = transformRampOrder(buildXoOrder())

            if (result.kind !== 'xo') throw new Error('expected xo order')
            expect(result.swapOrderId).toBe('order-xo-1')
            expect(result.payInAddress).toBe('PAYIN1234')
        })

        it('maps sourceAmount to a Decimal equal to the API string', () => {
            const result = transformRampOrder(buildXoOrder())

            if (result.kind !== 'xo') throw new Error('expected xo order')
            expect(result.sourceAmount).toBeInstanceOf(Decimal)
            expect(result.sourceAmount.equals(new Decimal('12.5'))).toBe(true)
        })

        it('maps toAddress, status and payInAddressTag from provider_response', () => {
            const result = transformRampOrder(buildXoOrder())

            if (result.kind !== 'xo') throw new Error('expected xo order')
            expect(result.toAddress).toBe('TOADDR5678')
            expect(result.status).toBe('pending')
            expect(result.payInAddressTag).toBe('tag-123')
        })

        it('leaves payInAddressTag undefined when absent', () => {
            const result = transformRampOrder(
                buildXoOrder({
                    xo: {
                        pay_in_address: 'PAYIN1234',
                        source_amount: '12.5',
                        provider_response: {
                            payInAddress: 'PAYIN1234',
                            toAddress: 'TOADDR5678',
                            status: 'pending',
                        },
                    },
                }),
            )

            if (result.kind !== 'xo') throw new Error('expected xo order')
            expect(result.payInAddressTag).toBeUndefined()
        })
    })

    describe('transformRampOrder (Meld)', () => {
        it('detects the Meld shape when meld is present', () => {
            const result = transformRampOrder(buildMeldOrder())

            expect(result.kind).toBe('meld')
        })

        it('maps swapOrderId and widgetUrl', () => {
            const result = transformRampOrder(buildMeldOrder())

            if (result.kind !== 'meld') throw new Error('expected meld order')
            expect(result.swapOrderId).toBe('order-meld-1')
            expect(result.widgetUrl).toBe('https://widget.example.com/session')
        })
    })

    describe('transformRampOrder (neither)', () => {
        it('throws when both xo and meld are null', () => {
            expect(() =>
                transformRampOrder({
                    swap_order_id: 'order-empty',
                    xo: null,
                    meld: null,
                }),
            ).toThrow('Ramp order has neither xo nor meld payload')
        })
    })
})
