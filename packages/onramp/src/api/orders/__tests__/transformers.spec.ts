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

import type { RampOrderApiResponse } from '../schema'
import { transformRampOrder } from '../transformers'

const order = (steps: RampOrderApiResponse['steps']): RampOrderApiResponse => ({
    order_id: 'order-1',
    status: 'pending',
    expires_at: null,
    steps,
})

describe('transformRampOrder', () => {
    it('maps a checkout step to a Meld order', () => {
        expect(
            transformRampOrder(
                order([
                    {
                        kind: 'open_checkout',
                        url: 'https://checkout.example/pay',
                    },
                ]),
            ),
        ).toEqual({
            kind: 'meld',
            orderId: 'order-1',
            checkoutUrl: 'https://checkout.example/pay',
        })
    })

    it('rejects a checkout URL that is not https', () => {
        expect(() =>
            transformRampOrder(
                order([
                    {
                        kind: 'open_checkout',
                        url: 'http://checkout.example/pay',
                    },
                ]),
            ),
        ).toThrow()
    })

    it('maps deposit instructions with a memo to an XO order', () => {
        expect(
            transformRampOrder(
                order([
                    {
                        kind: 'deposit_instructions',
                        address: 'PAYIN',
                        memo: '12345',
                    },
                ]),
            ),
        ).toEqual({
            kind: 'xo',
            orderId: 'order-1',
            deposit: { address: 'PAYIN', memo: '12345' },
        })
    })

    it('maps deposit instructions without a memo to a null memo', () => {
        const result = transformRampOrder(
            order([
                { kind: 'deposit_instructions', address: 'PAYIN', memo: null },
            ]),
        )

        expect(result).toMatchObject({ deposit: { memo: null } })
    })

    it('ignores a signing step beside the deposit instructions', () => {
        const result = transformRampOrder(
            order([
                { kind: 'sign_transactions', transactions: ['x'] },
                { kind: 'deposit_instructions', address: 'PAYIN' },
            ]),
        )

        expect(result.kind).toBe('xo')
    })

    it('throws when no step says where to go next', () => {
        expect(() =>
            transformRampOrder(
                order([{ kind: 'sign_transactions', transactions: ['x'] }]),
            ),
        ).toThrow(/no checkout or deposit step/)
    })
})
