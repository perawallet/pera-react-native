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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { useSwapQuoteDetails } from '../useSwapQuoteDetails'

const { mockFormatAssetAmount, mockFormatSwapRate, thresholds } = vi.hoisted(
    () => ({
        mockFormatAssetAmount: vi.fn(
            (amount: { toString: () => string }, asset: { unitName: string }) =>
                `${amount.toString()} ${asset.unitName}`,
        ),
        mockFormatSwapRate: vi.fn(() => '1 ALGO ≈ 0.25 USDC'),
        thresholds: { low: 1, high: 5 },
    }),
)

vi.mock('@perawallet/wallet-core-remote-config', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-remote-config')
        >()
    return {
        ...actual,
        useRemoteConfig: () => ({
            getNumberValue: (key: string) =>
                key === actual.RemoteConfigKeys.swap_price_impact_low_threshold
                    ? thresholds.low
                    : thresholds.high,
        }),
    }
})

vi.mock('@perawallet/wallet-core-swaps', async () => ({
    apiSlippageToPercent: (
        await vi.importActual<
            typeof import('@packages/swaps/src/utils/slippage')
        >('@packages/swaps/src/utils/slippage')
    ).apiSlippageToPercent,
    formatSwapRate: mockFormatSwapRate,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    formatAssetAmount: mockFormatAssetAmount,
}))

const ALGO = { assetId: '0', unitName: 'ALGO', decimals: 6 }
const USDC = { assetId: '31566704', unitName: 'USDC', decimals: 6 }
const PERA = { assetId: '99', unitName: 'PERA', decimals: 6 }

const makeQuote = (overrides: Partial<SwapQuote> = {}): SwapQuote =>
    ({ assetIn: ALGO, assetOut: USDC, ...overrides }) as SwapQuote

describe('useSwapQuoteDetails', () => {
    beforeEach(() => {
        thresholds.low = 1
        thresholds.high = 5
        mockFormatAssetAmount.mockClear()
    })

    it('formats the rate from the quote', () => {
        const quote = makeQuote({ price: new Decimal('0.25') })

        const { result } = renderHook(() => useSwapQuoteDetails(quote))

        expect(result.current.rateDisplay).toBe('1 ALGO ≈ 0.25 USDC')
        expect(mockFormatSwapRate).toHaveBeenCalledWith(quote)
    })

    it('shows the price impact rounded to two decimals', () => {
        const quote = makeQuote({ priceImpact: new Decimal('1.23456') })

        const { result } = renderHook(() => useSwapQuoteDetails(quote))

        expect(result.current.priceImpactDisplay).toBe('1.23%')
    })

    it('shows placeholders when the quote has no optional details', () => {
        const { result } = renderHook(() => useSwapQuoteDetails(makeQuote()))

        expect(result.current).toMatchObject({
            priceImpactDisplay: '-',
            priceImpactLevel: 'none',
            slippageDisplay: '-',
            peraFeeDisplay: '-',
            providerDisplay: '-',
        })
        expect(mockFormatAssetAmount).not.toHaveBeenCalled()
    })

    it.each([
        ['0.99', 'low'],
        ['1', 'medium'],
        ['4.99', 'medium'],
        ['5', 'high'],
        ['12', 'high'],
    ])('rates a %s%% price impact as %s', (impact, level) => {
        const quote = makeQuote({ priceImpact: new Decimal(impact) })

        const { result } = renderHook(() => useSwapQuoteDetails(quote))

        expect(result.current.priceImpactLevel).toBe(level)
    })

    it('reads the price impact thresholds from remote config', () => {
        thresholds.low = 0.1
        thresholds.high = 0.4
        const quote = makeQuote({ priceImpact: new Decimal('0.5') })

        const { result } = renderHook(() => useSwapQuoteDetails(quote))

        expect(result.current.priceImpactLevel).toBe('high')
    })

    it('shows the slippage fraction as a percent', () => {
        const quote = makeQuote({ slippage: new Decimal('0.005') })

        const { result } = renderHook(() => useSwapQuoteDetails(quote))

        expect(result.current.slippageDisplay).toBe('0.5%')
    })

    it('formats the Pera fee in the fee asset', () => {
        const quote = makeQuote({
            peraFeeAmount: new Decimal('1500'),
            peraFeeAsset: PERA as SwapQuote['assetIn'],
        })

        const { result } = renderHook(() => useSwapQuoteDetails(quote))

        expect(result.current.peraFeeDisplay).toBe('1500 PERA')
    })

    it('formats the Pera fee in the input asset when no fee asset is given', () => {
        const quote = makeQuote({ peraFeeAmount: new Decimal('1500') })

        const { result } = renderHook(() => useSwapQuoteDetails(quote))

        expect(result.current.peraFeeDisplay).toBe('1500 ALGO')
    })

    it.each([
        [{ provider: 'tinyman', providerDisplayName: 'Tinyman' }, 'Tinyman'],
        [{ provider: 'tinyman' }, 'tinyman'],
    ] as const)('names the provider from %o', (fields, expected) => {
        const { result } = renderHook(() =>
            useSwapQuoteDetails(makeQuote(fields as Partial<SwapQuote>)),
        )

        expect(result.current.providerDisplay).toBe(expected)
    })
})
