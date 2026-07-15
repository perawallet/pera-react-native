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

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    transformSwapHistoryItem,
    transformSwapDistinctPairItem,
} from '../transformers'
import type {
    SwapHistoryItemApiResponse,
    SwapDistinctPairItemApiResponse,
} from '../schema'

const apiAsset = (assetId: string) => ({
    asset_id: assetId,
    logo: null,
    name: `Asset ${assetId}`,
    unit_name: `A${assetId}`,
    total: '1000',
    fraction_decimals: 6,
    verification_tier: 'verified',
    usd_value: '1.00',
})

describe('transformSwapHistoryItem', () => {
    const apiItem = (
        overrides: Partial<SwapHistoryItemApiResponse> = {},
    ): SwapHistoryItemApiResponse =>
        ({
            // Production always sees a string here — `uint64IdSchema` converts
            // the backend's >2^53 numeric id before the transformer runs.
            id: '1',
            id_str: '1',
            provider: 'tinyman',
            status: 'completed',
            completed_datetime: '2026-01-01T00:00:00Z',
            transaction_group_id: 'GROUP1',
            asset_in: apiAsset('0'),
            asset_out: apiAsset('31566704'),
            amount_in: '1.5',
            amount_out: '1.499',
            amount_in_usd_value: '1.50',
            amount_out_usd_value: '1.49',
            ...overrides,
        }) as unknown as SwapHistoryItemApiResponse

    it('maps fields and transforms the nested in/out assets', () => {
        const result = transformSwapHistoryItem(apiItem())

        expect(result.id).toBe('1')
        expect(result.idStr).toBe('1')
        expect(result.provider).toBe('tinyman')
        expect(result.status).toBe('completed')
        expect(result.completedDatetime).toBe('2026-01-01T00:00:00Z')
        expect(result.transactionGroupId).toBe('GROUP1')
        expect(result.assetIn.assetId).toBe('0')
        expect(result.assetOut.assetId).toBe('31566704')
        expect(result.assetOut.unitName).toBe('A31566704')
        expect(result.amountInUsdValue).toBe('1.50')
        expect(result.amountOutUsdValue).toBe('1.49')
    })

    it('parses amounts into Decimal preserving precision beyond float range', () => {
        const highPrecision = '1234567890.123456789012345'
        const result = transformSwapHistoryItem(
            apiItem({ amount_in: highPrecision, amount_out: '0.000001' }),
        )

        expect(result.amountIn).toBeInstanceOf(Decimal)
        expect(result.amountIn.toString()).toBe(highPrecision)
        expect(result.amountOut.equals(new Decimal('0.000001'))).toBe(true)
    })
})

describe('transformSwapDistinctPairItem', () => {
    it('transforms the nested asset pair and passes through pair metadata', () => {
        const data = {
            asset_in: apiAsset('0'),
            asset_out: apiAsset('31566704'),
            swap_datetime: '2026-01-01T00:00:00Z',
            pair_key: '0-31566704',
        } as unknown as SwapDistinctPairItemApiResponse

        const result = transformSwapDistinctPairItem(data)

        expect(result.assetIn.assetId).toBe('0')
        expect(result.assetOut.assetId).toBe('31566704')
        expect(result.swapDatetime).toBe('2026-01-01T00:00:00Z')
        expect(result.pairKey).toBe('0-31566704')
    })
})
