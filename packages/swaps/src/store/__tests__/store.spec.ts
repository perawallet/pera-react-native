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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const registerStoreMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: registerStoreMock,
    }
})

import { useSwapsStore } from '../store'

describe('swaps/store', () => {
    beforeEach(() => {
        useSwapsStore.getState().resetState()
        useSwapsStore.getState().setIsLocalCurrencyInput(false)
    })

    test('store initializes with defaults', () => {
        const { result } = renderHook(() => useSwapsStore())

        expect(result.current.fromAsset).toBe('0')
        expect(result.current.toAsset).toBe('31566704')
    })

    test('setFromAsset updates fromAsset state', () => {
        const { result } = renderHook(() => useSwapsStore())

        act(() => {
            result.current.setFromAsset('1234')
        })

        expect(result.current.fromAsset).toBe('1234')
    })

    test('setToAsset updates toAsset state', () => {
        const { result } = renderHook(() => useSwapsStore())

        act(() => {
            result.current.setToAsset('5678')
        })

        expect(result.current.toAsset).toBe('5678')
    })

    test('slippage defaults to null', async () => {
        const { useSwapsStore } = await import('../store')

        const { result } = renderHook(() => useSwapsStore())

        expect(result.current.slippage).toBeNull()
    })

    test('setSlippage updates slippage state', async () => {
        const { useSwapsStore } = await import('../store')

        const { result } = renderHook(() => useSwapsStore())

        act(() => {
            result.current.setSlippage('1.5')
        })

        expect(result.current.slippage).toBe('1.5')

        act(() => {
            result.current.setSlippage(null)
        })

        expect(result.current.slippage).toBeNull()
    })

    test('isLocalCurrencyInput defaults to false', () => {
        const { result } = renderHook(() => useSwapsStore())

        expect(result.current.isLocalCurrencyInput).toBe(false)
    })

    test('setIsLocalCurrencyInput toggles the swap-scoped preference', () => {
        const { result } = renderHook(() => useSwapsStore())

        act(() => {
            result.current.setIsLocalCurrencyInput(true)
        })

        expect(result.current.isLocalCurrencyInput).toBe(true)

        act(() => {
            result.current.setIsLocalCurrencyInput(false)
        })

        expect(result.current.isLocalCurrencyInput).toBe(false)
    })

    test('resetState preserves isLocalCurrencyInput', () => {
        const { result } = renderHook(() => useSwapsStore())

        act(() => {
            result.current.setIsLocalCurrencyInput(true)
        })

        act(() => {
            result.current.resetState()
        })

        expect(result.current.isLocalCurrencyInput).toBe(true)
    })

    test('resetState resets assets but preserves slippage', async () => {
        const { useSwapsStore } = await import('../store')

        const { result } = renderHook(() => useSwapsStore())

        act(() => {
            result.current.setFromAsset('1234')
            result.current.setToAsset('5678')
            result.current.setSlippage('2.5')
        })

        act(() => {
            result.current.resetState()
        })

        expect(result.current.fromAsset).toBe('0')
        expect(result.current.toAsset).toBe('31566704')
        expect(result.current.slippage).toBe('2.5')
    })

    test('registers resetState and clearStorage with the store registry', () => {
        const registration = registerStoreMock.mock.calls
            .map(([r]) => r)
            .find(r => r?.name === 'swaps-store')
        expect(registration).toBeDefined()

        act(() => {
            useSwapsStore.getState().setFromAsset('999')
        })
        act(() => registration!.resetState())
        expect(useSwapsStore.getState().fromAsset).toBe('0')
        expect(() => registration!.clearStorage()).not.toThrow()
    })
})
