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

import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useNavigationLock } from '../useNavigationLock'

type BeforeRemoveListener = (e: { preventDefault: () => void }) => void

const mockUnsubscribe = vi.fn()
let registeredListener: Optional<BeforeRemoveListener>
const mockAddListener = vi.fn(
    (_event: string, listener: BeforeRemoveListener) => {
        registeredListener = listener
        return mockUnsubscribe
    },
)
const mockSetOptions = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            addListener: mockAddListener,
            setOptions: mockSetOptions,
        }),
    }
})

describe('useNavigationLock', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registeredListener = undefined
    })

    it('does nothing when isLocked is false', () => {
        renderHook(() => useNavigationLock(false))

        expect(mockAddListener).not.toHaveBeenCalled()
        expect(mockSetOptions).not.toHaveBeenCalled()
    })

    it('subscribes to beforeRemove and hides headerLeft when isLocked is true', () => {
        renderHook(() => useNavigationLock(true))

        expect(mockAddListener).toHaveBeenCalledWith(
            'beforeRemove',
            expect.any(Function),
        )
        expect(mockSetOptions).toHaveBeenCalledWith({
            headerLeft: expect.any(Function),
        })
        const call = mockSetOptions.mock.calls[0][0]
        expect(call.headerLeft()).toBeNull()
    })

    it('listener calls preventDefault by default', () => {
        renderHook(() => useNavigationLock(true))

        const event = { preventDefault: vi.fn() }
        registeredListener?.(event)

        expect(event.preventDefault).toHaveBeenCalledTimes(1)
    })

    it('listener does not call preventDefault after allowProgrammaticNavigation', () => {
        const { result } = renderHook(() => useNavigationLock(true))

        act(() => {
            result.current.allowProgrammaticNavigation()
        })

        const event = { preventDefault: vi.fn() }
        registeredListener?.(event)

        expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('unsubscribes and restores headerLeft when isLocked flips back to false', () => {
        const { rerender } = renderHook(
            ({ isLocked }: { isLocked: boolean }) =>
                useNavigationLock(isLocked),
            { initialProps: { isLocked: true } },
        )

        mockSetOptions.mockClear()

        rerender({ isLocked: false })

        expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
        expect(mockSetOptions).toHaveBeenCalledWith({ headerLeft: undefined })
    })

    it('unsubscribes and restores headerLeft on unmount', () => {
        const { unmount } = renderHook(() => useNavigationLock(true))

        mockSetOptions.mockClear()

        unmount()

        expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
        expect(mockSetOptions).toHaveBeenCalledWith({ headerLeft: undefined })
    })

    it('re-arms the lock after a previous lock cycle was bypassed', () => {
        const { result, rerender } = renderHook(
            ({ isLocked }: { isLocked: boolean }) =>
                useNavigationLock(isLocked),
            { initialProps: { isLocked: true } },
        )

        act(() => {
            result.current.allowProgrammaticNavigation()
        })

        rerender({ isLocked: false })
        rerender({ isLocked: true })

        const event = { preventDefault: vi.fn() }
        registeredListener?.(event)

        expect(event.preventDefault).toHaveBeenCalledTimes(1)
    })
})
