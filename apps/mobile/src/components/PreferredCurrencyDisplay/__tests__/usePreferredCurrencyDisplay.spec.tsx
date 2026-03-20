/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { usePreferredCurrencyDisplay } from '../usePreferredCurrencyDisplay'

const mockUseCurrency = vi.hoisted(() => vi.fn())
const mockUsePreferredCurrencyPriceQuery = vi.hoisted(() => vi.fn())
const mockUseAssetPricesQuery = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: mockUseCurrency,
    usePreferredCurrencyPriceQuery: mockUsePreferredCurrencyPriceQuery,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPricesQuery: mockUseAssetPricesQuery,
    ALGO_ASSET_ID: '0',
    ALGO_ASSET: { unitName: 'ALGO' },
}))

describe('usePreferredCurrencyDisplay', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'USD',
            fallbackCurrency: 'USD',
            usdToPreferred: (v: Decimal) => v,
        })

        mockUseAssetPricesQuery.mockReturnValue({
            data: new Map(),
            isPending: false,
        })

        mockUsePreferredCurrencyPriceQuery.mockReturnValue({
            data: undefined,
            isPending: false,
        })
    })

    it('displays in preferred fiat currency with converted value', () => {
        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'EUR',
            fallbackCurrency: 'USD',
            usdToPreferred: (v: Decimal) => v.mul(Decimal('0.85')),
        })

        const usdPrices = new Map([
            ['0', { assetId: '0', usdPrice: Decimal('1') }],
        ])
        mockUseAssetPricesQuery.mockReturnValue({
            data: usdPrices,
            isPending: false,
        })

        const { result } = renderHook(() =>
            usePreferredCurrencyDisplay(Decimal(10), '0'),
        )

        expect(result.current.displayCurrency).toBe('EUR')
        // 10 * 1 (USD price) = 10 USD, usdToPreferred(10) = 10 * 0.85 = 8.5
        expect(result.current.convertedValue).toEqual(Decimal(8.5))
        expect(result.current.isPending).toBe(false)
    })

    it('falls back when preferred=ALGO and source=ALGO', () => {
        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'ALGO',
            fallbackCurrency: 'USD',
            usdToPreferred: (v: Decimal) => v,
        })

        // ALGO USD price = 0.15
        const usdPrices = new Map([
            ['0', { assetId: '0', usdPrice: Decimal('0.15') }],
        ])
        mockUseAssetPricesQuery.mockReturnValue({
            data: usdPrices,
            isPending: false,
        })

        // USD→USD rate = 1
        mockUsePreferredCurrencyPriceQuery.mockReturnValue({
            data: { usdPrice: Decimal('1') },
            isPending: false,
        })

        const { result } = renderHook(() =>
            usePreferredCurrencyDisplay(Decimal(100), '0'),
        )

        expect(result.current.displayCurrency).toBe('USD')
        // 100 * 0.15 (USD price) = 15 USD value, * 1 (fallback rate) = 15
        expect(result.current.convertedValue).toEqual(Decimal(15))
        expect(result.current.isPending).toBe(false)
    })

    it('displays in ALGO when preferred=ALGO and source is non-ALGO', () => {
        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'ALGO',
            fallbackCurrency: 'USD',
            // ALGO preferred: usdToPreferred divides by ALGO USD price
            usdToPreferred: (v: Decimal) => v.div(Decimal('0.15')),
        })

        // ASA USD price = 1.50 (meaning 1 ASA = $1.50)
        const usdPrices = new Map([
            ['123', { assetId: '123', usdPrice: Decimal('1.50') }],
        ])
        mockUseAssetPricesQuery.mockReturnValue({
            data: usdPrices,
            isPending: false,
        })

        const { result } = renderHook(() =>
            usePreferredCurrencyDisplay(Decimal(5), '123'),
        )

        expect(result.current.displayCurrency).toBe('ALGO')
        // 5 * 1.50 = 7.5 USD, / 0.15 = 50 ALGO
        expect(result.current.convertedValue).toEqual(Decimal(50))
        expect(result.current.isPending).toBe(false)
    })

    it('uses fallback currency when forceFallback=true', () => {
        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'ALGO',
            fallbackCurrency: 'EUR',
            usdToPreferred: (v: Decimal) => v.div(Decimal('0.15')),
        })

        const usdPrices = new Map([
            ['123', { assetId: '123', usdPrice: Decimal('1.50') }],
        ])
        mockUseAssetPricesQuery.mockReturnValue({
            data: usdPrices,
            isPending: false,
        })

        mockUsePreferredCurrencyPriceQuery.mockReturnValue({
            data: { usdPrice: Decimal('0.85') },
            isPending: false,
        })

        const { result } = renderHook(() =>
            usePreferredCurrencyDisplay(Decimal(5), '123', true),
        )

        expect(result.current.displayCurrency).toBe('EUR')
        // 5 * 1.50 (USD) = 7.5 USD * 0.85 (EUR rate) = 6.375
        expect(result.current.convertedValue).toEqual(Decimal(6.375))
    })

    it('returns isPending=true while fiat prices load', () => {
        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'EUR',
            fallbackCurrency: 'USD',
            usdToPreferred: (v: Decimal) => v,
        })

        mockUseAssetPricesQuery.mockReturnValue({
            data: new Map(),
            isPending: true,
        })

        const { result } = renderHook(() =>
            usePreferredCurrencyDisplay(Decimal(10), '0'),
        )

        expect(result.current.isPending).toBe(true)
        expect(result.current.convertedValue).toBeNull()
    })

    it('passes null through when sourceAmount is null', () => {
        const { result } = renderHook(() =>
            usePreferredCurrencyDisplay(null, '0'),
        )

        expect(result.current.convertedValue).toBeNull()
        expect(result.current.isPending).toBe(false)
    })

    it('passes undefined through when sourceAmount is undefined', () => {
        const { result } = renderHook(() =>
            usePreferredCurrencyDisplay(undefined, '0'),
        )

        expect(result.current.convertedValue).toBeNull()
    })

    it('returns isPending=true while fallback rate loads', () => {
        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'ALGO',
            fallbackCurrency: 'EUR',
            usdToPreferred: (v: Decimal) => v,
        })

        mockUseAssetPricesQuery.mockReturnValue({
            data: new Map(),
            isPending: false,
        })

        mockUsePreferredCurrencyPriceQuery.mockReturnValue({
            data: undefined,
            isPending: true,
        })

        const { result } = renderHook(() =>
            usePreferredCurrencyDisplay(Decimal(100), '0'),
        )

        expect(result.current.isPending).toBe(true)
        expect(result.current.convertedValue).toBeNull()
    })

    it('uses pre-fetched usdPrice and skips asset price query', () => {
        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'EUR',
            fallbackCurrency: 'USD',
            usdToPreferred: (v: Decimal) => v.mul(Decimal('0.85')),
        })

        // Return empty map — should not matter since preFetchedUsdPrice is provided
        mockUseAssetPricesQuery.mockReturnValue({
            data: new Map(),
            isPending: false,
        })

        const { result } = renderHook(() =>
            usePreferredCurrencyDisplay(
                Decimal(10),
                '123',
                false,
                Decimal('1.50'),
            ),
        )

        expect(result.current.displayCurrency).toBe('EUR')
        // 10 * 1.50 = 15 USD, usdToPreferred(15) = 15 * 0.85 = 12.75
        expect(result.current.convertedValue).toEqual(Decimal(12.75))
        expect(result.current.isPending).toBe(false)

        // Verify it was called with empty array (no per-item fetch)
        expect(mockUseAssetPricesQuery).toHaveBeenCalledWith([])
    })
})
