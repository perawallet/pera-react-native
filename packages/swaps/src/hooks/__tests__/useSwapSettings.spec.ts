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

// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSwapsStore } from '../../store'
import { useSwapSettings } from '../useSwapSettings'

describe('swaps/useSwapSettings', () => {
    beforeEach(() => {
        useSwapsStore.getState().resetState()
        useSwapsStore.getState().setSlippage(null)
        useSwapsStore.getState().setIsLocalCurrencyInput(false)
    })

    test('reads and writes the settings without a chain scope', () => {
        const { result } = renderHook(() => useSwapSettings())

        act(() => {
            result.current.setSlippage('1.5')
            result.current.setIsLocalCurrencyInput(true)
        })

        expect(result.current.slippage).toBe('1.5')
        expect(result.current.isLocalCurrencyInput).toBe(true)
    })

    test('keeps the settings when the asset pair resets', () => {
        const { result } = renderHook(() => useSwapSettings())

        act(() => {
            result.current.setSlippage('2')
            useSwapsStore.getState().resetState()
        })

        expect(result.current.slippage).toBe('2')
    })
})
