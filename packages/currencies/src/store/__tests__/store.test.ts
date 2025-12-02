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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCurrenciesStore, initCurrenciesStore } from '../index'

// Mock the storage service
vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useKeyValueStorageService: vi.fn(() => ({
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    })),
}))

describe('CurrenciesStore', () => {
    beforeEach(() => {
        initCurrenciesStore()
    })

    test('should initialize with USD as default currency', () => {
        const { result } = renderHook(() => useCurrenciesStore())

        expect(result.current.preferredCurrency).toBe('USD')
    })

    test('should update preferred currency', () => {
        const { result } = renderHook(() => useCurrenciesStore())

        act(() => {
            result.current.setPreferredCurrency('EUR')
        })

        expect(result.current.preferredCurrency).toBe('EUR')
    })

    test('should update to different currencies', () => {
        const { result } = renderHook(() => useCurrenciesStore())

        act(() => {
            result.current.setPreferredCurrency('GBP')
        })
        expect(result.current.preferredCurrency).toBe('GBP')

        act(() => {
            result.current.setPreferredCurrency('JPY')
        })
        expect(result.current.preferredCurrency).toBe('JPY')
    })

    test('should persist preferred currency across re-renders', () => {
        const { result, rerender } = renderHook(() => useCurrenciesStore())

        act(() => {
            result.current.setPreferredCurrency('CAD')
        })

        rerender()

        expect(result.current.preferredCurrency).toBe('CAD')
    })
})
