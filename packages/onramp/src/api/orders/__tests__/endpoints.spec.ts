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

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { createRampOrder } from '../endpoints'
import type { RampOrderApiResponse } from '../schema'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const xoOrder: RampOrderApiResponse = {
    swap_order_id: 'order-1',
    xo: {
        pay_in_address: 'PAYIN_ADDRESS',
        source_amount: '0.5',
        provider_response: {
            payInAddress: 'PAYIN_ADDRESS',
            toAddress: 'DEST_ADDRESS',
            status: 'waiting',
        },
    },
    meld: null,
}

describe('createRampOrder', () => {
    it('sends the source amount as a plain decimal string', async () => {
        let requestBody: unknown = null
        server.use(
            http.post('*/v1/ramp/orders/', async ({ request }) => {
                requestBody = await request.json()
                return HttpResponse.json(xoOrder)
            }),
        )

        await createRampOrder(
            {
                quote: 'quote-1',
                sourceAmount: new Decimal('0.00000005'),
                sourceAddress: null,
            },
            { chainId: 'algorand', networkId: 'mainnet' },
        )

        expect(requestBody).toEqual({
            quote: 'quote-1',
            source_amount: '0.00000005',
            source_address: null,
        })
    })
})
