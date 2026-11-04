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

import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import { queryClient } from '@perawallet/wallet-core-shared'
import { createSwapOrder, reportSwapOrder } from '../endpoints'
import { routerOrderItem, SCOPE_A } from '../../__tests__/routerFixtures'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    queryClient: vi.fn(),
}))

describe('order endpoints', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('creates an order from the quote id alone', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                order_id: 'order-1',
                status: 'pending',
                expires_at: null,
                steps: [],
            },
        })

        const order = await createSwapOrder('quote-1', SCOPE_A)

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                url: '/api/v4/swap/orders/',
                data: { quote_id: 'quote-1' },
            }),
        )
        expect(order.orderId).toBe('order-1')
    })

    test('reports sent transactions with their router chain', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: routerOrderItem() })

        await reportSwapOrder(
            'order-1',
            {
                status: 'sent',
                transactions: [
                    { scope: SCOPE_A, txHash: 'H1', purpose: 'swap' },
                ],
            },
            SCOPE_A,
        )

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'PATCH',
                url: '/api/v4/swap/orders/order-1/',
                data: {
                    status: 'sent',
                    transactions: [
                        {
                            chain: 'fake-a:main',
                            tx_hash: 'H1',
                            purpose: 'swap',
                        },
                    ],
                },
            }),
        )
    })

    test('reports a cancellation with no transactions', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: routerOrderItem({ status: 'cancelled' }),
        })

        await reportSwapOrder('order-1', { status: 'cancelled' }, SCOPE_A)

        const [{ data }] = (queryClient as Mock).mock.calls[0]
        expect(data).toEqual({ status: 'cancelled' })
    })
})
