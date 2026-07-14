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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect } from 'vitest'

import { useNumberPadAmount } from '../useNumberPadAmount'

const type = (
    result: { current: ReturnType<typeof useNumberPadAmount> },
    keys: (string | undefined)[],
) => keys.forEach(key => act(() => result.current.handleKey(key)))

describe('useNumberPadAmount', () => {
    it('starts empty with a zero Decimal amount', () => {
        const { result } = renderHook(() => useNumberPadAmount({ decimals: 6 }))

        expect(result.current.amount).toBeUndefined()
        expect(result.current.amountDecimal.isZero()).toBe(true)
    })

    it('prefixes a leading decimal separator with zero', () => {
        const { result } = renderHook(() => useNumberPadAmount({ decimals: 6 }))

        type(result, ['.'])

        expect(result.current.amount).toBe('0.')
    })

    it('ignores a second decimal separator', () => {
        const { result } = renderHook(() => useNumberPadAmount({ decimals: 6 }))

        type(result, ['1', '.', '5', '.'])

        expect(result.current.amount).toBe('1.5')
    })

    it('caps the fraction length at the configured decimals', () => {
        const { result } = renderHook(() => useNumberPadAmount({ decimals: 2 }))

        type(result, ['1', '.', '2', '3', '4'])

        expect(result.current.amount).toBe('1.23')
    })

    it('blocks the decimal separator entirely for zero-decimal assets', () => {
        const { result } = renderHook(() => useNumberPadAmount({ decimals: 0 }))

        type(result, ['1', '.'])

        expect(result.current.amount).toBe('1')
    })

    it('deletes the last character on backspace and clears to null', () => {
        const { result } = renderHook(() => useNumberPadAmount({ decimals: 6 }))

        type(result, ['2', '5', undefined])
        expect(result.current.amount).toBe('2')

        type(result, [undefined])
        expect(result.current.amount).toBeNull()
    })

    it('exposes the typed value as a Decimal', () => {
        const { result } = renderHook(() => useNumberPadAmount({ decimals: 6 }))

        type(result, ['2', '5', '.', '5'])

        expect(result.current.amountDecimal.toFixed(2)).toBe('25.50')
    })

    it('resets via setAmount', () => {
        const { result } = renderHook(() => useNumberPadAmount({ decimals: 6 }))

        type(result, ['9'])
        act(() => result.current.setAmount(null))

        expect(result.current.amount).toBeNull()
        expect(result.current.amountDecimal.isZero()).toBe(true)
    })
})
