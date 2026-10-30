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
import { usePassphraseWordInput } from '../usePassphraseWordInput'

describe('usePassphraseWordInput', () => {
    it('reports the edited word with the position it belongs to', () => {
        const onChangeWord = vi.fn()
        const { result } = renderHook(() =>
            usePassphraseWordInput({
                index: 2,
                onChangeWord,
                onFocusWord: vi.fn(),
                onSubmitWord: vi.fn(),
            }),
        )

        act(() => result.current.handleChangeText('word'))

        expect(onChangeWord).toHaveBeenCalledWith('word', 2)
    })

    it('reports the focused and submitted positions', () => {
        const onFocusWord = vi.fn()
        const onSubmitWord = vi.fn()
        const { result } = renderHook(() =>
            usePassphraseWordInput({
                index: 1,
                onChangeWord: vi.fn(),
                onFocusWord,
                onSubmitWord,
            }),
        )

        act(() => result.current.handleFocus())
        act(() => result.current.handleSubmitEditing())

        expect(onFocusWord).toHaveBeenCalledWith(1)
        expect(onSubmitWord).toHaveBeenCalledWith(1)
    })
})
