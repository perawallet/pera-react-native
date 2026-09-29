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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAmountKeyboardInput } from '../useAmountKeyboardInput.web'

const press = (
    key: string,
    init: KeyboardEventInit = {},
    target: EventTarget = document.body,
) =>
    target.dispatchEvent(
        new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
            ...init,
        }),
    )

const setup = () => {
    const amount = document.createElement('div')
    amount.tabIndex = 0
    document.body.appendChild(amount)
    const params = {
        onKey: vi.fn(),
        onPaste: vi.fn(),
        onSubmit: vi.fn(),
        amountRef: { current: amount as never },
        isActive: true,
    }
    const hook = renderHook(() => useAmountKeyboardInput(params))
    return { ...params, amount, hook }
}

describe('useAmountKeyboardInput (web)', () => {
    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('focuses the amount when the screen opens', async () => {
        const { amount } = setup()

        await waitFor(() => expect(document.activeElement).toBe(amount))
    })

    it('sends digits, both decimal separators and Backspace to the keypad handler', () => {
        const { onKey } = setup()

        press('7')
        press(',')
        press('.')
        press('Backspace')

        expect(onKey.mock.calls).toEqual([['7'], ['.'], ['.'], []])
    })

    it('submits on Enter from the amount', () => {
        const { onSubmit } = setup()

        press('Enter')

        expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it('leaves Enter to a focused button, so Next is not pressed on top of it', () => {
        const { onSubmit } = setup()
        const max = document.createElement('div')
        max.tabIndex = 0
        document.body.appendChild(max)
        max.focus()

        press('Enter', {}, max)

        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('ignores keys typed into a text field and shortcuts with modifiers', () => {
        const { onKey } = setup()
        const note = document.createElement('textarea')
        document.body.appendChild(note)

        press('5', {}, note)
        press('5', { ctrlKey: true })
        press('5', { metaKey: true })

        expect(onKey).not.toHaveBeenCalled()
    })

    it('hands pasted text to the paste handler', () => {
        const { onPaste } = setup()
        const event = new Event('paste', { bubbles: true, cancelable: true })
        Object.assign(event, { clipboardData: { getData: () => '12,5' } })

        document.body.dispatchEvent(event)

        expect(onPaste).toHaveBeenCalledWith('12,5')
    })

    it('ignores keys while a later send step covers the screen', () => {
        const onKey = vi.fn()
        const onSubmit = vi.fn()
        renderHook(() =>
            useAmountKeyboardInput({
                onKey,
                onPaste: vi.fn(),
                onSubmit,
                amountRef: { current: null },
                isActive: false,
            }),
        )

        press('3')
        press('Enter')

        expect(onKey).not.toHaveBeenCalled()
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('stops listening when the screen closes', () => {
        const { onKey, hook } = setup()

        hook.unmount()
        press('1')

        expect(onKey).not.toHaveBeenCalled()
    })
})
