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

import { describe, expect, test } from 'vitest'
import { registerSecondFakeSwapAdapter } from '../../../__tests__/fakeSwapAdapter'
import { swapHistoryResponseSchema } from '../schema'
import { transformSwapOrderItem } from '../../orders/transformers'
import { swapAssetRefOf } from '../../router-ids'
import {
    routerAsset,
    routerOrderItem,
    SCOPE_B,
} from '../../__tests__/routerFixtures'

const parseRows = (results: unknown[]) =>
    swapHistoryResponseSchema
        .parse({ results })
        .results.map(item => transformSwapOrderItem(item, swapAssetRefOf))

describe('swap history rows', () => {
    test('reads a pre-router row with no assets, accounts or amounts', () => {
        const [item] = parseRows([
            routerOrderItem({
                aggregator: null,
                provider: null,
                funding_method: null,
                source_account: null,
                destination_account: null,
                source_asset: null,
                destination_asset: null,
                source_amount: null,
                destination_amount_expected: null,
                destination_amount_minimum: null,
                source_amount_usd_value: null,
                destination_amount_usd_value: null,
            }),
        ])

        expect(item).toMatchObject({
            orderId: 'order-1',
            provider: null,
            assetIn: null,
            assetOut: null,
            amountIn: null,
            amountOut: null,
        })
    })

    test('reads a row whose legs sit on two chains', () => {
        registerSecondFakeSwapAdapter()

        const [item] = parseRows([
            routerOrderItem({
                destination_asset: routerAsset(SCOPE_B, 'usdc'),
            }),
        ])

        expect(item.assetIn?.ref.chainId).toBe('algorand')
        expect(item.assetOut?.ref.chainId).toBe('ethereum')
    })

    test('accepts the expired and refunded statuses', () => {
        const items = parseRows([
            routerOrderItem({ status: 'expired' }),
            routerOrderItem({ status: 'refunded' }),
        ])

        expect(items.map(item => item.status)).toEqual(['expired', 'refunded'])
    })
})
