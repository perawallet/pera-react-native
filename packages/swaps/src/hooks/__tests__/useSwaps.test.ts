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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { registerTestPlatform } from '@test-utils'

describe('swaps/useSwaps', () => {
    beforeEach(() => {
        vi.resetModules()
        registerTestPlatform()
    })

    test('exposes fromAsset and toAsset', async () => {
        const { initSwapsStore } = await import('../../store')
        const { useSwaps } = await import('../useSwaps')

        initSwapsStore()

        const { result } = renderHook(() => useSwaps())

        expect(result.current.fromAsset).toBe('0')
        expect(result.current.toAsset).toBe('1001')
    })

    test('setFromAsset updates fromAsset', async () => {
        const { initSwapsStore } = await import('../../store')
        const { useSwaps } = await import('../useSwaps')

        initSwapsStore()

        const { result } = renderHook(() => useSwaps())

        act(() => {
            result.current.setFromAsset('999')
        })

        expect(result.current.fromAsset).toBe('999')
    })

    test('setToAsset updates toAsset', async () => {
        const { initSwapsStore } = await import('../../store')
        const { useSwaps } = await import('../useSwaps')

        initSwapsStore()

        const { result } = renderHook(() => useSwaps())

        act(() => {
            result.current.setToAsset('777')
        })

        expect(result.current.toAsset).toBe('777')
    })
})
