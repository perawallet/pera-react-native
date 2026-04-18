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

    test('migrates v1 state by adding slippage: null', () => {
        const migrate = useSwapsStore.persist.getOptions().migrate as (
            state: unknown,
            version: number,
        ) => unknown

        const v1 = { fromAsset: '0', toAsset: '31566704' }
        const migrated = migrate(v1, 1) as { slippage: string | null }

        expect(migrated.slippage).toBeNull()
    })

    test('migrates v2 state by stripping fromAsset and toAsset', () => {
        const migrate = useSwapsStore.persist.getOptions().migrate as (
            state: unknown,
            version: number,
        ) => unknown

        const v2 = {
            fromAsset: '0',
            toAsset: '31566704',
            slippage: '1.0',
        }
        const migrated = migrate(v2, 2) as Record<string, unknown>

        expect(migrated.fromAsset).toBeUndefined()
        expect(migrated.toAsset).toBeUndefined()
        expect(migrated.slippage).toBe('1.0')
    })

    test('migrate returns state as-is for the current version', () => {
        const migrate = useSwapsStore.persist.getOptions().migrate as (
            state: unknown,
            version: number,
        ) => unknown

        const current = { slippage: '2.0' }
        expect(migrate(current, 3)).toBe(current)
    })
})
