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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAmountKeyboardInput } from '../useAmountKeyboardInput'

describe('useAmountKeyboardInput (native default)', () => {
    it('never calls back: phones type amounts on the on-screen keypad', () => {
        const onKey = vi.fn()

        renderHook(() =>
            useAmountKeyboardInput({
                onKey,
                onPaste: vi.fn(),
                onSubmit: vi.fn(),
                amountRef: { current: null },
                isActive: true,
            }),
        )

        expect(onKey).not.toHaveBeenCalled()
    })
})
