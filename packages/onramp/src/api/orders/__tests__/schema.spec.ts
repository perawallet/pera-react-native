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

import {
    createRampOrderResponseSchema,
    openCheckoutStepSchema,
} from '../schema'

describe('createRampOrderResponseSchema', () => {
    it('reads steps of a kind the app does not run', () => {
        const parsed = createRampOrderResponseSchema.parse({
            order_id: 'order-1',
            status: 'pending',
            expires_at: null,
            steps: [{ kind: 'sign_transactions', transactions: ['x'] }],
        })

        expect(parsed.steps).toHaveLength(1)
    })

    it('rejects a status the router does not define', () => {
        expect(() =>
            createRampOrderResponseSchema.parse({
                order_id: 'order-1',
                status: 'paused',
                steps: [],
            }),
        ).toThrow()
    })
})

describe('openCheckoutStepSchema', () => {
    it('accepts an https checkout URL', () => {
        expect(
            openCheckoutStepSchema.parse({
                kind: 'open_checkout',
                url: 'https://checkout.example/pay',
            }).url,
        ).toBe('https://checkout.example/pay')
    })

    it.each(['http://checkout.example/pay', 'javascript:alert(1)'])(
        'rejects %s',
        url => {
            expect(() =>
                openCheckoutStepSchema.parse({ kind: 'open_checkout', url }),
            ).toThrow()
        },
    )
})
