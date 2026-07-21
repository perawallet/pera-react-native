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

let mockIsLocalCurrencyInput = false
let mockPreferredCurrency = 'EUR'
let mockFallbackCurrency = 'ALGO'
let mockUsdToPreferred = (usd: Decimal) => usd.mul(new Decimal('0.9')) // EUR/USD
let mockAssetUsdPrice: Decimal | undefined = new Decimal('0.2') // USD per ALGO
let mockAssetDecimals: number | undefined = 6
let mockFallbackRate: Decimal | undefined = new Decimal(1) // USD/USD
let mockCurrencies: { id: string; name: string; symbol: string }[] = [
    { id: 'EUR', name: 'Euro', symbol: '€' },
    { id: 'USD', name: 'US Dollar', symbol: '$' },
]

const ASSET_ID = '0'

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwaps: () => ({ isLocalCurrencyInput: mockIsLocalCurrencyInput }),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        preferredCurrency: mockPreferredCurrency,
        fallbackCurrency: mockFallbackCurrency,
        usdToPreferred: mockUsdToPreferred,
    }),
    useCurrenciesQuery: () => ({ data: mockCurrencies }),
    usePreferredCurrencyPriceQuery: () => ({
        data:
            mockFallbackRate === undefined
                ? undefined
                : { id: mockFallbackCurrency, usdPrice: mockFallbackRate },
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPricesQuery: () => ({
        data:
            mockAssetUsdPrice === undefined
                ? new Map()
                : new Map([
                      [
                          ASSET_ID,
                          { assetId: ASSET_ID, usdPrice: mockAssetUsdPrice },
                      ],
                  ]),
    }),
    useAssetsQuery: () => ({
        data: new Map([
            [
                ASSET_ID,
                {
                    assetId: ASSET_ID,
                    unitName: 'ALGO',
                    decimals: mockAssetDecimals,
                },
            ],
        ]),
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    isAlgoAssetName: (value: string) => value === 'ALGO',
}))

describe('useSwapLocalCurrency', () => {
    beforeEach(() => {
        mockIsLocalCurrencyInput = false
        mockPreferredCurrency = 'EUR'
        mockFallbackCurrency = 'ALGO'
        mockUsdToPreferred = (usd: Decimal) => usd.mul(new Decimal('0.9'))
        mockAssetUsdPrice = new Decimal('0.2')
        mockAssetDecimals = 6
        mockFallbackRate = new Decimal(1)
        mockCurrencies = [
            { id: 'EUR', name: 'Euro', symbol: '€' },
            { id: 'USD', name: 'US Dollar', symbol: '$' },
        ]
    })

    it('uses the preferred fiat as the local currency and converts both ways', () => {
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

    it('falls back to the fallback fiat (USD) when ALGO is the preferred currency', () => {
        mockPreferredCurrency = 'ALGO'
        mockFallbackCurrency = 'USD'
        mockFallbackRate = new Decimal(1) // USD/USD

        const { result } = renderHook(() => useSwapLocalCurrency(ASSET_ID))

        expect(result.current.localCurrency).toBe('USD')
        expect(result.current.localCurrencySymbol).toBe('$')
        // 10 ALGO × 0.2 USD × 1 = 2.00 USD
        expect(result.current.assetToFiat(new Decimal(10))?.toString()).toBe(
            '2',
        )
        expect(result.current.fiatToAsset(new Decimal(2))?.toString()).toBe(
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
        mockAssetUsdPrice = undefined

        const { result } = renderHook(() => useSwapLocalCurrency(ASSET_ID))

        expect(result.current.isReady).toBe(false)
        expect(result.current.fiatToAsset(new Decimal(1))).toBeNull()
        expect(result.current.assetToFiat(new Decimal(1))).toBeNull()
    })

    it('is not ready while the fiat rate is zero (loading)', () => {
        mockUsdToPreferred = () => new Decimal(0)

        const { result } = renderHook(() => useSwapLocalCurrency(ASSET_ID))

        expect(result.current.isReady).toBe(false)
        expect(result.current.fiatToAsset(new Decimal(1))).toBeNull()
    })

    it('falls back to the currency code when no symbol is known', () => {
        mockPreferredCurrency = 'AED'
        mockCurrencies = [{ id: 'EUR', name: 'Euro', symbol: '€' }]

        const { result } = renderHook(() => useSwapLocalCurrency(ASSET_ID))

        expect(result.current.localCurrency).toBe('AED')
        expect(result.current.localCurrencySymbol).toBe('AED')
    })

    it('exposes the swap-scoped isLocalCurrencyInput flag', () => {
        mockIsLocalCurrencyInput = true

        const { result } = renderHook(() => useSwapLocalCurrency(ASSET_ID))

        expect(result.current.isLocalCurrencyInput).toBe(true)
    })
})
