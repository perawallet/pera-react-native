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

import { createRampOrderResponseSchema } from '../schema'

const meldOrder = (widgetUrl: string) => ({
    swap_order_id: 'order-meld-1',
    xo: null,
    meld: { provider_response: { widgetUrl, token: 'tok-1' } },
})

describe('createRampOrderResponseSchema', () => {
    it('accepts an https Meld widget URL', () => {
        const result = createRampOrderResponseSchema.safeParse(
            meldOrder('https://widget.example.com/session'),
        )

        expect(result.success).toBe(true)
    })

    it.each([
        'http://widget.example.com/session',
        'javascript:alert(1)',
        'expanded.html?deeplink=algorand://X',
    ])('rejects a Meld widget URL of %s', widgetUrl => {
        const result = createRampOrderResponseSchema.safeParse(
            meldOrder(widgetUrl),
        )

        expect(result.success).toBe(false)
    })
})
