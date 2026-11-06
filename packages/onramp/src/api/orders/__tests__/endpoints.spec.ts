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
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { SCOPE } from '../../../__tests__/routerFixtures'
import { toOnrampUserMessage } from '../../../errors'
import { cancelRampOrder, createRampOrder } from '../endpoints'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('createRampOrder', () => {
    it('posts the quote id alone and returns the order', async () => {
        let requestBody: unknown = null
        server.use(
            http.post('*/api/v4/swap/orders/', async ({ request }) => {
                requestBody = await request.json()
                return HttpResponse.json(
                    {
                        order_id: 'order-1',
                        status: 'pending',
                        expires_at: null,
                        steps: [
                            {
                                kind: 'open_checkout',
                                url: 'https://checkout.example/pay',
                            },
                        ],
                    },
                    { status: 201 },
                )
            }),
        )

        const order = await createRampOrder({ quoteId: 'quote-1' }, SCOPE)

        expect(requestBody).toEqual({ quote_id: 'quote-1' })
        expect(order).toEqual({
            kind: 'meld',
            orderId: 'order-1',
            checkoutUrl: 'https://checkout.example/pay',
        })
    })
})

describe('cancelRampOrder', () => {
    it('patches the order to cancelled', async () => {
        let captured: { path: string; body: unknown } | null = null
        server.use(
            http.patch(
                '*/api/v4/swap/orders/:orderId/',
                async ({ request }) => {
                    captured = {
                        path: new URL(request.url).pathname,
                        body: await request.json(),
                    }
                    return HttpResponse.json({})
                },
            ),
        )

        await cancelRampOrder({ orderId: 'order-1' }, SCOPE)

        expect(captured).toEqual({
            path: '/api/v4/swap/orders/order-1/',
            body: { status: 'cancelled' },
        })
    })

    it('rejects with the router message when the order is not pending', async () => {
        server.use(
            http.patch('*/api/v4/swap/orders/:orderId/', () =>
                HttpResponse.json(
                    {
                        error: 'The order cannot be cancelled.',
                        code: 'invalid_status_transition',
                    },
                    { status: 409 },
                ),
            ),
        )

        const error = await cancelRampOrder(
            { orderId: 'order-1' },
            SCOPE,
        ).catch((caught: unknown) => caught)

        expect(toOnrampUserMessage(error)).toBe(
            'The order cannot be cancelled.',
        )
    })
})
