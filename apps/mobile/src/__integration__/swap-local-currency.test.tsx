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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { displayUnitsToBaseUnits } from '@perawallet/wallet-core-blockchain'
import { useSwapsStore } from '@perawallet/wallet-core-swaps'
import { useSwapLocalCurrency } from '@modules/swap/hooks'
import { useSwapAmountSection } from '@modules/swap/components/SwapAmountSection/useSwapAmountSection'
import type { Nullable } from '@perawallet/wallet-core-shared'

const ALGO_ID = '0'
const ALGO_DECIMALS = 6

// ALGO = 0.20 USD, EUR rate = 1.0 → 1 ALGO = 0.20 EUR → 100 EUR = 500 ALGO.
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        preferredCurrency: 'EUR',
        fallbackCurrency: 'ALGO',
        usdToPreferred: (usd: Decimal) => usd,
    }),
    useCurrenciesQuery: () => ({
        data: [{ id: 'EUR', name: 'Euro', symbol: '€' }],
    }),
    usePreferredCurrencyPriceQuery: () => ({
        data: { id: 'EUR', usdPrice: new Decimal(1) },
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPricesQuery: () => ({
        data: new Map([
            [ALGO_ID, { assetId: ALGO_ID, usdPrice: new Decimal('0.2') }],
        ]),
    }),
    useAssetsQuery: () => ({
        data: new Map([
            [
                ALGO_ID,
                { assetId: ALGO_ID, unitName: 'ALGO', decimals: ALGO_DECIMALS },
            ],
        ]),
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => ({
        deviceInfo: { getDeviceLocale: () => 'en-US' },
    }),
    getProvider: () => ({
        keyValueStorage: {
            getItem: vi.fn().mockReturnValue(null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        },
    }),
}))

const renderSwapPayInput = (onAmountChange: (a: Nullable<Decimal>) => void) =>
    renderHook(() => {
        const localCurrency = useSwapLocalCurrency(ALGO_ID)
        const section = useSwapAmountSection({
            variant: 'pay',
            assetId: ALGO_ID,
            amount: null,
            onAmountChange,
            isLocalCurrencyInput: localCurrency.isLocalCurrencyInput,
            fiatToAsset: localCurrency.fiatToAsset,
            assetToFiat: localCurrency.assetToFiat,
        })
        return { localCurrency, section }
    })

describe('Flow: Swap local-currency (fiat) input', () => {
    beforeEach(() => {
        useSwapsStore.getState().resetState()
        useSwapsStore.getState().setIsLocalCurrencyInput(false)
    })

    it('converts a typed fiat amount into the asset base units sent to the quote', () => {
        useSwapsStore.getState().setIsLocalCurrencyInput(true)

        const onAmountChange = vi.fn()
        const { result } = renderSwapPayInput(onAmountChange)

        expect(result.current.localCurrency.localCurrency).toBe('EUR')
        expect(result.current.localCurrency.localCurrencySymbol).toBe('€')
        expect(result.current.section.isFiatInput).toBe(true)

        act(() => {
            result.current.section.handleTextChange('100')
        })

        // 100 EUR ÷ 0.20 EUR/ALGO = 500 ALGO (display units)
        const assetAmount = onAmountChange.mock.calls.at(-1)?.[0] as Decimal
        expect(assetAmount).toEqual(new Decimal(500))

        // …which the quote path turns into 500_000_000 microALGO
        expect(
            displayUnitsToBaseUnits(assetAmount, ALGO_DECIMALS).toFixed(0),
        ).toBe('500000000')
    })

    it('keeps asset-unit input untouched when the toggle is off', () => {
        // store starts off (beforeEach)
        const onAmountChange = vi.fn()
        const { result } = renderSwapPayInput(onAmountChange)

        expect(result.current.section.isFiatInput).toBe(false)

        act(() => {
            result.current.section.handleTextChange('500')
        })

        // asset mode: the typed value is the asset amount, unchanged
        expect(onAmountChange).toHaveBeenLastCalledWith(new Decimal(500))
    })
})
