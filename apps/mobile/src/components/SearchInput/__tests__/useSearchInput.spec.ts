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

import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSearchInput } from '../useSearchInput'

describe('useSearchInput', () => {
    it('keeps the typed text and reports it as the current value', () => {
        const onChangeText = vi.fn()
        const { result } = renderHook(() => useSearchInput({ onChangeText }))

        act(() => result.current.handleChangeText('Algorand'))

        expect(result.current.currentValue).toBe('Algorand')
        expect(result.current.hasValue).toBe(true)
        expect(onChangeText).toHaveBeenCalledWith('Algorand')
    })

    it('clears the typed text and reports the empty value', () => {
        const onChangeText = vi.fn()
        const { result } = renderHook(() => useSearchInput({ onChangeText }))

        act(() => result.current.handleChangeText('Algorand'))
        act(() => result.current.handleClear())

        expect(result.current.currentValue).toBe('')
        expect(result.current.hasValue).toBe(false)
        expect(onChangeText).toHaveBeenLastCalledWith('')
    })

    it('follows the controlled value rather than the typed one', () => {
        const { result } = renderHook(() => useSearchInput({ value: 'alice' }))

        act(() => result.current.handleChangeText('Algorand'))

        expect(result.current.currentValue).toBe('alice')
    })
})
