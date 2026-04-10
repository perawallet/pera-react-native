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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useSwapAmountSection } from '../useSwapAmountSection'

const mockAsset = {
    assetId: '0',
    name: 'Algorand',
    unitName: 'ALGO',
    decimals: 6,
    creator: { address: '' },
    totalSupply: new Decimal(10_000_000_000),
}

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: () => ({
        data: new Map([['0', mockAsset]]),
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => ({
        deviceInfo: {
            getDeviceLocale: () => 'en-US',
        },
    }),
}))

describe('useSwapAmountSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns isPay true for pay variant', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'pay',
                assetId: '0',
                amount: null,
                onAmountChange: vi.fn(),
            }),
        )

        expect(result.current.isPay).toBe(true)
    })

    it('returns isPay false for receive variant', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'receive',
                assetId: '0',
                amount: null,
            }),
        )

        expect(result.current.isPay).toBe(false)
    })

    it('returns hasPositiveAmount false when amount is null', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'pay',
                assetId: '0',
                amount: null,
                onAmountChange: vi.fn(),
            }),
        )

        expect(result.current.hasPositiveAmount).toBe(false)
    })

    it('returns hasPositiveAmount true when amount is positive', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'pay',
                assetId: '0',
                amount: new Decimal(5),
                onAmountChange: vi.fn(),
            }),
        )

        expect(result.current.hasPositiveAmount).toBe(true)
    })

    it('returns hasPositiveAmount false when amount is zero', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'pay',
                assetId: '0',
                amount: new Decimal(0),
                onAmountChange: vi.fn(),
            }),
        )

        expect(result.current.hasPositiveAmount).toBe(false)
    })

    it('normalizes comma to dot in handleTextChange', () => {
        const onAmountChange = vi.fn()
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'pay',
                assetId: '0',
                amount: null,
                onAmountChange,
            }),
        )

        act(() => {
            result.current.handleTextChange('1,5')
        })

        expect(onAmountChange).toHaveBeenCalledWith(new Decimal('1.5'))
    })

    it('calls onAmountChange with null for empty input', () => {
        const onAmountChange = vi.fn()
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'pay',
                assetId: '0',
                amount: new Decimal(5),
                onAmountChange,
            }),
        )

        act(() => {
            result.current.handleTextChange('')
        })

        expect(onAmountChange).toHaveBeenCalledWith(null)
    })

    it('calls onAmountChange with null for lone dot', () => {
        const onAmountChange = vi.fn()
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'pay',
                assetId: '0',
                amount: null,
                onAmountChange,
            }),
        )

        act(() => {
            result.current.handleTextChange('.')
        })

        expect(onAmountChange).toHaveBeenCalledWith(null)
    })

    it('ignores invalid text input without calling onAmountChange', () => {
        const onAmountChange = vi.fn()
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'pay',
                assetId: '0',
                amount: null,
                onAmountChange,
            }),
        )

        act(() => {
            result.current.handleTextChange('abc')
        })

        expect(onAmountChange).not.toHaveBeenCalled()
    })

    it('does not call onAmountChange in receive variant', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'receive',
                assetId: '0',
                amount: null,
            }),
        )

        act(() => {
            result.current.handleTextChange('5')
        })

        // No onAmountChange provided for receive, so nothing happens
    })

    it('returns empty displayValue for receive variant with null amount', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'receive',
                assetId: '0',
                amount: null,
            }),
        )

        expect(result.current.displayValue).toBe('')
    })

    it('returns formatted displayValue for receive variant with amount', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                variant: 'receive',
                assetId: '0',
                amount: new Decimal('1234.56'),
            }),
        )

        // Should be formatted via formatCurrency, not raw toString
        expect(result.current.displayValue).not.toBe('')
        expect(result.current.displayValue).toBeDefined()
    })
})
