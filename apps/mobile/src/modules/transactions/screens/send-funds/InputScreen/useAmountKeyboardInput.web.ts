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

import { useEffect, useRef } from 'react'
import type { UseAmountKeyboardInputParams } from './useAmountKeyboardInput'

const isTextField = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement &&
    (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * Lets a desktop keyboard drive the Send amount through the same handler as
 * the on-screen keypad, so both give identical results. `,` counts as the
 * decimal separator too, for keyboards whose numpad types one.
 */
export const useAmountKeyboardInput = ({
    onKey,
    onPaste,
    onSubmit,
    amountRef,
    isActive,
}: UseAmountKeyboardInputParams): void => {
    const latest = useRef({ onKey, onPaste, onSubmit })
    latest.current = { onKey, onPaste, onSubmit }

    useEffect(() => {
        if (!isActive) return
        // A frame late: the sheet's Modal focus trap moves focus to its first
        // focusable element (the backdrop) as the sheet opens.
        const frame = requestAnimationFrame(() => {
            ;(amountRef.current as unknown as HTMLElement | null)?.focus()
        })
        return () => cancelAnimationFrame(frame)
    }, [amountRef, isActive])

    useEffect(() => {
        if (!isActive) return
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || isTextField(event.target)) return
            if (event.ctrlKey || event.metaKey || event.altKey) return
            const { key } = event
            if (/^[0-9]$/.test(key)) {
                event.preventDefault()
                latest.current.onKey(key)
            } else if (key === '.' || key === ',') {
                event.preventDefault()
                latest.current.onKey('.')
            } else if (key === 'Backspace') {
                event.preventDefault()
                latest.current.onKey()
            } else if (key === 'Enter') {
                // A focused button already acts on Enter; submitting as well
                // would press Next on top of MAX or a keypad key.
                const active = document.activeElement
                const isOnAmount =
                    active === null ||
                    active === document.body ||
                    active === (amountRef.current as unknown as Element | null)
                if (!isOnAmount) return
                event.preventDefault()
                latest.current.onSubmit()
            }
        }
        const handlePaste = (event: ClipboardEvent) => {
            if (isTextField(event.target)) return
            const text = event.clipboardData?.getData('text')
            if (!text) return
            event.preventDefault()
            latest.current.onPaste(text)
        }
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('paste', handlePaste)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('paste', handlePaste)
        }
    }, [amountRef, isActive])
}
