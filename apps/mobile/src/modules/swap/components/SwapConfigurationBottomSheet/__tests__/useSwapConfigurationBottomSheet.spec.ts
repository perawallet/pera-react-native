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
import { useSwapConfigurationBottomSheet } from '../useSwapConfigurationBottomSheet'
import type { Nullable } from '@perawallet/wallet-core-shared'

let mockSlippage: Nullable<string> = null
let mockPreferredCurrency: string = 'ALGO'

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwaps: () => ({ slippage: mockSlippage }),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({ preferredCurrency: mockPreferredCurrency }),
}))

describe('useSwapConfigurationBottomSheet', () => {
    beforeEach(() => {
        mockSlippage = null
        mockPreferredCurrency = 'ALGO'
    })

    it('initializes with defaults when no persisted slippage and ALGO preferred', () => {
        const onApply = vi.fn()
        const { result } = renderHook(() =>
            useSwapConfigurationBottomSheet({ isVisible: true, onApply }),
        )

        expect(result.current.balanceText).toBe('')
        expect(result.current.slippageText).toBe('')
        expect(result.current.useLocalCurrency).toBe(false)
        expect(result.current.isApplyEnabled).toBe(true)
    })

    it('initializes slippageText from persisted slippage', () => {
        mockSlippage = '1.5'
        const onApply = vi.fn()
        const { result } = renderHook(() =>
            useSwapConfigurationBottomSheet({ isVisible: true, onApply }),
        )

        expect(result.current.slippageText).toBe('1.5')
    })

    it('initializes useLocalCurrency true when preferred currency is fiat', () => {
        mockPreferredCurrency = 'USD'
        const onApply = vi.fn()
        const { result } = renderHook(() =>
            useSwapConfigurationBottomSheet({ isVisible: true, onApply }),
        )

        expect(result.current.useLocalCurrency).toBe(true)
    })

    it('applying with 50% balance invokes onApply with balancePercentage 50', () => {
        const onApply = vi.fn()
        const { result } = renderHook(() =>
            useSwapConfigurationBottomSheet({ isVisible: true, onApply }),
        )

        act(() => {
            result.current.setBalanceText('50')
        })
        act(() => {
            result.current.handleApply()
        })

        expect(onApply).toHaveBeenCalledWith({
            balancePercentage: 50,
            slippageTolerance: null,
            useLocalCurrency: false,
        })
    })

    it('typing 150 in balance shows error and disables Apply', () => {
        const onApply = vi.fn()
        const { result } = renderHook(() =>
            useSwapConfigurationBottomSheet({ isVisible: true, onApply }),
        )

        act(() => {
            result.current.setBalanceText('150')
        })

        expect(result.current.isBalanceError).toBe(true)
        expect(result.current.isApplyEnabled).toBe(false)

        act(() => {
            result.current.handleApply()
        })
        expect(onApply).not.toHaveBeenCalled()
    })

    it('typing 11 in slippage shows error and disables Apply', () => {
        const onApply = vi.fn()
        const { result } = renderHook(() =>
            useSwapConfigurationBottomSheet({ isVisible: true, onApply }),
        )

        act(() => {
            result.current.setSlippageText('11')
        })

        expect(result.current.isSlippageError).toBe(true)
        expect(result.current.isApplyEnabled).toBe(false)
    })

    it('accepts slippage within valid range', () => {
        const onApply = vi.fn()
        const { result } = renderHook(() =>
            useSwapConfigurationBottomSheet({ isVisible: true, onApply }),
        )

        act(() => {
            result.current.setSlippageText('0.5')
        })

        expect(result.current.isSlippageError).toBe(false)
        expect(result.current.isApplyEnabled).toBe(true)
    })

    it('normalizes comma decimal separator to dot', () => {
        const onApply = vi.fn()
        const { result } = renderHook(() =>
            useSwapConfigurationBottomSheet({ isVisible: true, onApply }),
        )

        act(() => {
            result.current.setSlippageText('0,5')
        })

        expect(result.current.slippageText).toBe('0.5')
        expect(result.current.isSlippageError).toBe(false)
    })

    it('handleApply with valid values emits expected SwapConfigurationResult', () => {
        const onApply = vi.fn()
        const { result } = renderHook(() =>
            useSwapConfigurationBottomSheet({ isVisible: true, onApply }),
        )

        act(() => {
            result.current.setBalanceText('25')
            result.current.setSlippageText('1')
            result.current.setUseLocalCurrency(true)
        })
        act(() => {
            result.current.handleApply()
        })

        expect(onApply).toHaveBeenCalledWith({
            balancePercentage: 25,
            slippageTolerance: '1',
            useLocalCurrency: true,
        })
    })

    it('toggling local currency off updates the emitted result', () => {
        mockPreferredCurrency = 'USD'
        const onApply = vi.fn()
        const { result } = renderHook(() =>
            useSwapConfigurationBottomSheet({ isVisible: true, onApply }),
        )

        expect(result.current.useLocalCurrency).toBe(true)

        act(() => {
            result.current.setUseLocalCurrency(false)
        })
        act(() => {
            result.current.handleApply()
        })

        expect(onApply).toHaveBeenCalledWith(
            expect.objectContaining({ useLocalCurrency: false }),
        )
    })

    it('emits null balancePercentage when balance text is empty', () => {
        const onApply = vi.fn()
        const { result } = renderHook(() =>
            useSwapConfigurationBottomSheet({ isVisible: true, onApply }),
        )

        act(() => {
            result.current.handleApply()
        })

        expect(onApply).toHaveBeenCalledWith(
            expect.objectContaining({ balancePercentage: null }),
        )
    })

    it('resets form state when sheet becomes visible again', () => {
        const onApply = vi.fn()
        const { result, rerender } = renderHook(
            ({ isVisible }: { isVisible: boolean }) =>
                useSwapConfigurationBottomSheet({ isVisible, onApply }),
            { initialProps: { isVisible: true } },
        )

        act(() => {
            result.current.setBalanceText('75')
            result.current.setSlippageText('2')
        })

        rerender({ isVisible: false })
        rerender({ isVisible: true })

        expect(result.current.balanceText).toBe('')
        expect(result.current.slippageText).toBe('')
    })
})
