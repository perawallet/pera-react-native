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
import { ALGO_ASSET_UNIT_NAME } from '@perawallet/wallet-core-assets'
import { useSettingsCurrencyScreen } from '../useSettingsCurrencyScreen'

const mockSetPreferredCurrency = vi.hoisted(() => vi.fn())
const mockSetFallbackCurrency = vi.hoisted(() => vi.fn())
const mockUseCurrency = vi.hoisted(() => vi.fn())
const mockUseCurrenciesQuery = vi.hoisted(() => vi.fn())
const mockInvalidateAssetPrices = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: mockUseCurrency,
    useCurrenciesQuery: mockUseCurrenciesQuery,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET_UNIT_NAME: 'ALGO',
    useInvalidateAssetPrices: () => ({
        invalidateAssetPrices: mockInvalidateAssetPrices,
    }),
}))

describe('useSettingsCurrencyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockUseCurrency.mockReturnValue({
            setPreferredCurrency: mockSetPreferredCurrency,
            setFallbackCurrency: mockSetFallbackCurrency,
            fallbackCurrency: 'USD',
            preferredCurrency: 'USD',
        })

        mockUseCurrenciesQuery.mockReturnValue({ data: [] })
    })

    it('sets ALGO as preferred and USD as the secondary currency when ALGO is selected', () => {
        const { result } = renderHook(() => useSettingsCurrencyScreen())

        result.current.setCurrency({ id: 'ALGO', name: 'Algo' } as never)

        expect(mockSetPreferredCurrency).toHaveBeenCalledWith('ALGO')
        expect(mockSetFallbackCurrency).toHaveBeenCalledWith('USD')
    })

    it('sets ALGO as the secondary currency when a fiat currency is selected', () => {
        const { result } = renderHook(() => useSettingsCurrencyScreen())

        result.current.setCurrency({ id: 'AED', name: 'Dirham' } as never)

        expect(mockSetPreferredCurrency).toHaveBeenCalledWith('AED')
        expect(mockSetFallbackCurrency).toHaveBeenCalledWith(
            ALGO_ASSET_UNIT_NAME,
        )
    })
})
