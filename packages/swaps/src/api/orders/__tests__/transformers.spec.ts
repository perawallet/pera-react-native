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

import { Decimal } from 'decimal.js'
import { describe, expect, test } from 'vitest'
import { registerSecondFakeSwapAdapter } from '../../../__tests__/fakeSwapAdapter'
import { swapAssetRefOf } from '../../router-ids'
import { swapOrderItemSchema } from '../schema'
import { transformSwapOrder, transformSwapOrderItem } from '../transformers'
import {
    routerAsset,
    routerOrderItem,
    SCOPE_A,
    SCOPE_B,
} from '../../__tests__/routerFixtures'

describe('transformSwapOrder', () => {
    test('maps signing steps on two chains to two scopes', () => {
        const order = transformSwapOrder({
            order_id: 'order-1',
            status: 'pending',
            expires_at: null,
            steps: [
                {
                    kind: 'sign_transactions',
                    chain: 'fake-a:main',
                    purpose: 'swap',
                    transactions: ['tx-a'],
                    signed_transactions: [null],
                },
                {
                    kind: 'sign_transactions',
                    chain: 'fake-b:main',
                    purpose: 'bridge',
                    transactions: ['tx-b'],
                },
            ],
        })

        expect(order.steps).toEqual([
            {
                kind: 'sign-transactions',
                scope: SCOPE_A,
                purpose: 'swap',
                transactions: ['tx-a'],
                presignedTransactions: [null],
            },
            {
                kind: 'sign-transactions',
                scope: SCOPE_B,
                purpose: 'bridge',
                transactions: ['tx-b'],
                presignedTransactions: null,
            },
        ])
    })

    test('keeps a step it cannot run as unsupported', () => {
        const order = transformSwapOrder({
            order_id: 'order-1',
            status: 'pending',
            expires_at: '2026-10-01T10:00:00Z',
            steps: [{ kind: 'deposit_instructions', address: 'x' }],
        })

        expect(order.steps).toEqual([
            { kind: 'unsupported', routerKind: 'deposit_instructions' },
        ])
        expect(order.expiresAt).toBe(Date.parse('2026-10-01T10:00:00Z'))
    })
})

describe('transformSwapOrderItem', () => {
    test('carries both legs on their own chains', () => {
        registerSecondFakeSwapAdapter()

        const item = transformSwapOrderItem(
            swapOrderItemSchema.parse(
                routerOrderItem({
                    destination_asset: routerAsset(SCOPE_B, 'usdc'),
                    destination_amount_received: '1190000',
                    transactions: [
                        { chain: 'fake-a:main', tx_hash: 'H1', role: 'swap' },
                        { chain: 'nope:1', tx_hash: 'H2', role: 'payout' },
                    ],
                }),
            ),
            swapAssetRefOf,
        )

        expect(item.assetIn?.ref).toEqual({ ...SCOPE_A, assetId: 'native' })
        expect(item.assetOut?.ref).toEqual({ ...SCOPE_B, assetId: 'usdc' })
        expect(item.amountOut).toEqual(new Decimal('1190000'))
        expect(item.transactions).toEqual([
            { scope: SCOPE_A, txHash: 'H1', role: 'swap' },
            { scope: null, txHash: 'H2', role: 'payout' },
        ])
    })

    test('passes the funding method through', () => {
        const item = transformSwapOrderItem(
            swapOrderItemSchema.parse(
                routerOrderItem({ funding_method: 'deposit' }),
            ),
            swapAssetRefOf,
        )

        expect(item.fundingMethod).toBe('deposit')
    })
})
