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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { useSwapLocalCurrency } from '../useSwapLocalCurrency'

import type { Nullable } from '@perawallet/wallet-core-shared'

let mockIsLocalCurrencyInput = false
let mockLocalCurrency = 'EUR'
let mockLocalCurrencySymbol = '€'
let mockLocalRate: Nullable<Decimal> = new Decimal('0.9') // EUR/USD
let mockAssetUsdPrice: Nullable<Decimal> = new Decimal('0.2') // USD per ALGO
let mockAssetDecimals: Nullable<number> = 6

const ASSET_ID = '0'

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwaps: () => ({ isLocalCurrencyInput: mockIsLocalCurrencyInput }),
}))

// Only the hook is stubbed — the conversion utils stay real so the tests
// exercise the actual fiat↔asset math end to end.
vi.mock('@perawallet/wallet-core-currencies', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-currencies')
        >()
    return {
        ...original,
        useLocalCurrency: () => ({
            localCurrency: mockLocalCurrency,
            localCurrencySymbol: mockLocalCurrencySymbol,
            localRate: mockLocalRate,
        }),
    }
})

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetUsdRate: () => ({
        assetUsdPrice: mockAssetUsdPrice,
        assetDecimals: mockAssetDecimals,
    }),
}))

describe('useSwapLocalCurrency', () => {
    beforeEach(() => {
        mockIsLocalCurrencyInput = false
        mockLocalCurrency = 'EUR'
        mockLocalCurrencySymbol = '€'
        mockLocalRate = new Decimal('0.9')
        mockAssetUsdPrice = new Decimal('0.2')
        mockAssetDecimals = 6
    })

    it('exposes the local currency and converts both ways', () => {
        const { result } = renderHook(() => useSwapLocalCurrency(ASSET_ID))

        expect(result.current.localCurrency).toBe('EUR')
        expect(result.current.localCurrencySymbol).toBe('€')
        expect(result.current.isReady).toBe(true)

        // 10 ALGO × 0.2 USD × 0.9 EUR/USD = 1.80 EUR
        expect(result.current.assetToFiat(new Decimal(10))?.toString()).toBe(
            '1.8',
        )
        // 1.80 EUR ÷ (0.2 × 0.9) = 10 ALGO
        expect(result.current.fiatToAsset(new Decimal('1.8'))?.toString()).toBe(
            '10',
        )
    })

    it('rounds the asset amount down to the asset decimals', () => {
        mockAssetUsdPrice = new Decimal('0.333333') // awkward price
        mockAssetDecimals = 2

        const { result } = renderHook(() => useSwapLocalCurrency(ASSET_ID))

        const asset = result.current.fiatToAsset(new Decimal('1'))
        // 1 / (0.333333 × 0.9) = 3.3333… → floored to 2 dp = 3.33
        expect(asset?.toString()).toBe('3.33')
    })

    it('is not ready and returns null when the asset has no USD price', () => {
        mockAssetUsdPrice = null

        const { result } = renderHook(() => useSwapLocalCurrency(ASSET_ID))

        expect(result.current.isReady).toBe(false)
        expect(result.current.fiatToAsset(new Decimal(1))).toBeNull()
        expect(result.current.assetToFiat(new Decimal(1))).toBeNull()
    })

    it('is not ready and returns null while the fiat rate is missing', () => {
        mockLocalRate = null

        const { result } = renderHook(() => useSwapLocalCurrency(ASSET_ID))

        expect(result.current.isReady).toBe(false)
        expect(result.current.fiatToAsset(new Decimal(1))).toBeNull()
        expect(result.current.assetToFiat(new Decimal(1))).toBeNull()
    })

    it('is not ready while the fiat rate is zero (loading)', () => {
        mockLocalRate = new Decimal(0)

        const { result } = renderHook(() => useSwapLocalCurrency(ASSET_ID))

        expect(result.current.isReady).toBe(false)
        expect(result.current.fiatToAsset(new Decimal(1))).toBeNull()
    })

    it('exposes the swap-scoped isLocalCurrencyInput flag', () => {
        mockIsLocalCurrencyInput = true

        const { result } = renderHook(() => useSwapLocalCurrency(ASSET_ID))

        expect(result.current.isLocalCurrencyInput).toBe(true)
    })
})
