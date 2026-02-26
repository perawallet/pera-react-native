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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Keyboard, type KeyboardEvent } from 'react-native'
import { useKeyboardHeight as useKeyboardHeightIOS } from '../useKeyboardHeight.ios'
import { useKeyboardHeight as useKeyboardHeightAndroid } from '../useKeyboardHeight.android'

const mockKeyboardEvent = (height: number) =>
    ({
        endCoordinates: { screenX: 0, screenY: 0, width: 0, height },
    }) as unknown as KeyboardEvent

function mockAddListener() {
    const listeners: Record<string, (e: KeyboardEvent) => void> = {}
    const removeFns: Array<ReturnType<typeof vi.fn>> = []

    vi.mocked(Keyboard.addListener).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event: string, callback: any) => {
            listeners[event] = callback
            const removeFn = vi.fn()
            removeFns.push(removeFn)
            return { remove: removeFn } as unknown as ReturnType<
                typeof Keyboard.addListener
            >
        },
    )

    return { listeners, removeFns }
}

describe('useKeyboardHeight (iOS)', () => {
    let listeners: Record<string, (e: KeyboardEvent) => void>
    let removeFns: Array<ReturnType<typeof vi.fn>>

    beforeEach(() => {
        vi.clearAllMocks()
        const mocked = mockAddListener()
        listeners = mocked.listeners
        removeFns = mocked.removeFns
    })

    it('returns initial state with zero height and not visible', () => {
        const { result } = renderHook(() => useKeyboardHeightIOS())

        expect(result.current.keyboardHeight).toBe(0)
        expect(result.current.isKeyboardVisible).toBe(false)
    })

    it('subscribes to keyboardWillShow and keyboardWillHide', () => {
        renderHook(() => useKeyboardHeightIOS())

        expect(Keyboard.addListener).toHaveBeenCalledWith(
            'keyboardWillShow',
            expect.any(Function),
        )
        expect(Keyboard.addListener).toHaveBeenCalledWith(
            'keyboardWillHide',
            expect.any(Function),
        )
    })

    it('updates state when keyboard is shown', () => {
        const { result } = renderHook(() => useKeyboardHeightIOS())

        act(() => {
            listeners['keyboardWillShow'](mockKeyboardEvent(320))
        })

        expect(result.current.keyboardHeight).toBe(320)
        expect(result.current.isKeyboardVisible).toBe(true)
    })

    it('resets state when keyboard is hidden', () => {
        const { result } = renderHook(() => useKeyboardHeightIOS())

        act(() => {
            listeners['keyboardWillShow'](mockKeyboardEvent(320))
        })

        act(() => {
            listeners['keyboardWillHide'](mockKeyboardEvent(0))
        })

        expect(result.current.keyboardHeight).toBe(0)
        expect(result.current.isKeyboardVisible).toBe(false)
    })

    it('cleans up listeners on unmount', () => {
        const { unmount } = renderHook(() => useKeyboardHeightIOS())
        unmount()

        expect(removeFns[0]).toHaveBeenCalled()
        expect(removeFns[1]).toHaveBeenCalled()
    })
})

describe('useKeyboardHeight (Android)', () => {
    let listeners: Record<string, (e: KeyboardEvent) => void>
    let removeFns: Array<ReturnType<typeof vi.fn>>

    beforeEach(() => {
        vi.clearAllMocks()
        const mocked = mockAddListener()
        listeners = mocked.listeners
        removeFns = mocked.removeFns
    })

    it('returns initial state with zero height and not visible', () => {
        const { result } = renderHook(() => useKeyboardHeightAndroid())

        expect(result.current.keyboardHeight).toBe(0)
        expect(result.current.isKeyboardVisible).toBe(false)
    })

    it('subscribes to keyboardDidShow and keyboardDidHide', () => {
        renderHook(() => useKeyboardHeightAndroid())

        expect(Keyboard.addListener).toHaveBeenCalledWith(
            'keyboardDidShow',
            expect.any(Function),
        )
        expect(Keyboard.addListener).toHaveBeenCalledWith(
            'keyboardDidHide',
            expect.any(Function),
        )
    })

    it('updates state when keyboard is shown', () => {
        const { result } = renderHook(() => useKeyboardHeightAndroid())

        act(() => {
            listeners['keyboardDidShow'](mockKeyboardEvent(280))
        })

        expect(result.current.keyboardHeight).toBe(280)
        expect(result.current.isKeyboardVisible).toBe(true)
    })

    it('resets state when keyboard is hidden', () => {
        const { result } = renderHook(() => useKeyboardHeightAndroid())

        act(() => {
            listeners['keyboardDidShow'](mockKeyboardEvent(280))
        })

        act(() => {
            listeners['keyboardDidHide'](mockKeyboardEvent(0))
        })

        expect(result.current.keyboardHeight).toBe(0)
        expect(result.current.isKeyboardVisible).toBe(false)
    })

    it('cleans up listeners on unmount', () => {
        const { unmount } = renderHook(() => useKeyboardHeightAndroid())
        unmount()

        expect(removeFns[0]).toHaveBeenCalled()
        expect(removeFns[1]).toHaveBeenCalled()
    })
})
