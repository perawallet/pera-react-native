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

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useAssetUsdRate } from '../useAssetUsdRate'

const mockUseAssetPricesQuery = vi.hoisted(() => vi.fn())
vi.mock('../useAssetPricesQuery', () => ({
    useAssetPricesQuery: mockUseAssetPricesQuery,
}))

const mockUseAssetsQuery = vi.hoisted(() => vi.fn())
vi.mock('../useAssetsQuery', () => ({
    useAssetsQuery: mockUseAssetsQuery,
}))

const ASSET_ID = '31566704'

describe('useAssetUsdRate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAssetPricesQuery.mockReturnValue({ data: undefined })
        mockUseAssetsQuery.mockReturnValue({ data: undefined })
    })

    it('returns the usd price and decimals for the asset', () => {
        mockUseAssetPricesQuery.mockReturnValue({
            data: new Map([
                [ASSET_ID, { assetId: ASSET_ID, usdPrice: new Decimal('1.0') }],
            ]),
        })
        mockUseAssetsQuery.mockReturnValue({
            data: new Map([[ASSET_ID, { assetId: ASSET_ID, decimals: 6 }]]),
        })

        const { result } = renderHook(() => useAssetUsdRate(ASSET_ID))

        expect(result.current.assetUsdPrice?.toString()).toBe('1')
        expect(result.current.assetDecimals).toBe(6)
    })

    it('returns nulls while the queries have no data', () => {
        const { result } = renderHook(() => useAssetUsdRate(ASSET_ID))

        expect(result.current.assetUsdPrice).toBeNull()
        expect(result.current.assetDecimals).toBeNull()
    })

    it('disables the price query for an empty asset id', () => {
        renderHook(() => useAssetUsdRate(''))

        expect(mockUseAssetPricesQuery).toHaveBeenCalledWith([''], false)
    })
})
