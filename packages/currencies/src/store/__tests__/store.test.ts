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

vi.mock('@perawallet/wallet-extension-platform-resources', () => {
    const store = new Map<string, string>()
    return {
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => {
                store.set(key, value)
            },
            removeItem: (key: string) => {
                store.delete(key)
            },
            setJSON: (key: string, value: unknown) => {
                store.set(key, JSON.stringify(value))
            },
            getJSON: (key: string) => {
                const v = store.get(key)
                return v ? JSON.parse(v) : null
            },
            getAllKeys: () => [...store.keys()],
        },
    }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
    }
})

describe('CurrenciesStore', () => {
    beforeEach(async () => {
        vi.resetModules()
        const { useCurrenciesStore } = await import('../index')
        useCurrenciesStore.getState().resetState()
    })

    test('should initialize with USD as default preferred currency', async () => {
        const { useCurrenciesStore } = await import('../index')
        const { result } = renderHook(() => useCurrenciesStore())

        expect(result.current.preferredCurrency).toBe('USD')
    })

    test('should initialize with USD as default fallback currency', async () => {
        const { useCurrenciesStore } = await import('../index')
        const { result } = renderHook(() => useCurrenciesStore())

        expect(result.current.fallbackCurrency).toBe('USD')
    })

    test('should update preferred currency', async () => {
        const { useCurrenciesStore } = await import('../index')
        const { result } = renderHook(() => useCurrenciesStore())

        act(() => {
            result.current.setPreferredCurrency('EUR')
        })

        expect(result.current.preferredCurrency).toBe('EUR')
    })

    test('should update fallback currency', async () => {
        const { useCurrenciesStore } = await import('../index')
        const { result } = renderHook(() => useCurrenciesStore())

        act(() => {
            result.current.setFallbackCurrency('GBP')
        })

        expect(result.current.fallbackCurrency).toBe('GBP')
    })

    test('should update to different currencies', async () => {
        const { useCurrenciesStore } = await import('../index')
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

    test('should persist preferred currency across re-renders', async () => {
        const { useCurrenciesStore } = await import('../index')
        const { result, rerender } = renderHook(() => useCurrenciesStore())

        act(() => {
            result.current.setPreferredCurrency('CAD')
        })

        rerender()

        expect(result.current.preferredCurrency).toBe('CAD')
    })

    test('should reset state to defaults', async () => {
        const { useCurrenciesStore } = await import('../index')
        const { result } = renderHook(() => useCurrenciesStore())

        act(() => {
            result.current.setPreferredCurrency('EUR')
            result.current.setFallbackCurrency('GBP')
        })

        expect(result.current.preferredCurrency).toBe('EUR')
        expect(result.current.fallbackCurrency).toBe('GBP')

        act(() => {
            result.current.resetState()
        })

        expect(result.current.preferredCurrency).toBe('USD')
        expect(result.current.fallbackCurrency).toBe('USD')
    })
})
