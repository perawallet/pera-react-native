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
import { registerTestPlatform } from '@perawallet/wallet-core-platform-integration'

describe('swaps/store', () => {
    beforeEach(() => {
        vi.resetModules()
        registerTestPlatform()
    })

    test('initSwapsStore initializes the store with defaults', async () => {
        const { initSwapsStore, useSwapsStore } = await import('../store')

        initSwapsStore()

        const { result } = renderHook(() => useSwapsStore())

        expect(result.current.fromAsset).toBe('0')
        expect(result.current.toAsset).toBe('1001')
    })

    test('setFromAsset updates fromAsset state', async () => {
        const { initSwapsStore, useSwapsStore } = await import('../store')

        initSwapsStore()

        const { result } = renderHook(() => useSwapsStore())

        act(() => {
            result.current.setFromAsset('1234')
        })

        expect(result.current.fromAsset).toBe('1234')
    })

    test('setToAsset updates toAsset state', async () => {
        const { initSwapsStore, useSwapsStore } = await import('../store')

        initSwapsStore()

        const { result } = renderHook(() => useSwapsStore())

        act(() => {
            result.current.setToAsset('5678')
        })

        expect(result.current.toAsset).toBe('5678')
    })
})
