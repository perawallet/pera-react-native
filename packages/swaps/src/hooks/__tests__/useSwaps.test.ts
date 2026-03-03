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

import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useSwapsStore } from '../../store'
import { useSwaps } from '../useSwaps'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: () => {
            const store = new Map<string, string>()
            return {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    store.set(key, value)
                },
                removeItem: (key: string) => {
                    store.delete(key)
                },
            }
        },
    }
})

describe('swaps/useSwaps', () => {
    beforeEach(() => {
        useSwapsStore.getState().resetState()
    })

    test('exposes fromAsset and toAsset', () => {
        const { result } = renderHook(() => useSwaps())

        expect(result.current.fromAsset).toBe('0')
        expect(result.current.toAsset).toBe('1001')
    })

    test('setFromAsset updates fromAsset', () => {
        const { result } = renderHook(() => useSwaps())

        act(() => {
            result.current.setFromAsset('999')
        })

        expect(result.current.fromAsset).toBe('999')
    })

    test('setToAsset updates toAsset', () => {
        const { result } = renderHook(() => useSwaps())

        act(() => {
            result.current.setToAsset('777')
        })

        expect(result.current.toAsset).toBe('777')
    })
})
