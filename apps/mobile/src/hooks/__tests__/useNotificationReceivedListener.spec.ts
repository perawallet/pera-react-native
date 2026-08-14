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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { mockInvalidate, mockUnsubscribe, listenerSlot, pushNotification } =
    vi.hoisted(() => {
        const listenerSlot: { current: (() => void) | null } = { current: null }
        const mockUnsubscribe = vi.fn()
        return {
            mockInvalidate: vi.fn(),
            mockUnsubscribe,
            listenerSlot,
            pushNotification: {
                addNotificationReceivedListener: vi.fn(
                    (listener: () => void) => {
                        listenerSlot.current = listener
                        return mockUnsubscribe
                    },
                ),
            } as {
                addNotificationReceivedListener?: (
                    listener: () => void,
                ) => () => void
            },
        }
    })

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => ({ pushNotification }),
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxInvalidator: () => ({ invalidate: mockInvalidate }),
}))

import { useNotificationReceivedListener } from '../useNotificationReceivedListener'

describe('useNotificationReceivedListener', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        listenerSlot.current = null
        pushNotification.addNotificationReceivedListener = vi.fn(
            (listener: () => void) => {
                listenerSlot.current = listener
                return mockUnsubscribe
            },
        )
    })

    it('invalidates the notification queries when a push arrives', () => {
        renderHook(() => useNotificationReceivedListener())

        expect(mockInvalidate).not.toHaveBeenCalled()
        listenerSlot.current?.()
        expect(mockInvalidate).toHaveBeenCalledTimes(1)
    })

    it('unsubscribes on unmount', () => {
        const { unmount } = renderHook(() => useNotificationReceivedListener())

        unmount()

        expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    })

    it('is a no-op on platforms without a foreground receive path', () => {
        pushNotification.addNotificationReceivedListener = undefined

        expect(() =>
            renderHook(() => useNotificationReceivedListener()),
        ).not.toThrow()
    })
})
