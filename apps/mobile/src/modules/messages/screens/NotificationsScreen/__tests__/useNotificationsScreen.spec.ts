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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    shouldRevealNewest,
    useNotificationsScreen,
} from '../useNotificationsScreen'
import {
    useInboxStatus,
    useNotificationsListQuery,
    useMarkNotificationsAsReadMutation,
    type PeraNotification,
} from '@perawallet/wallet-core-messages'

const mockMarkAsRead = vi.fn()

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxStatus: vi.fn(),
    useNotificationsListQuery: vi.fn(),
    useMarkNotificationsAsReadMutation: vi.fn(),
}))

vi.mock('@modules/messages/hooks', () => ({
    useNotificationPress: () => ({ handleNotificationPress: vi.fn() }),
}))

const notification = (id: string): PeraNotification =>
    ({ id }) as unknown as PeraNotification

const mockList = (
    notifications: PeraNotification[],
    overrides: { isRefetching?: boolean; refetch?: () => void } = {},
) =>
    vi.mocked(useNotificationsListQuery).mockReturnValue({
        data: notifications,
        isPending: false,
        fetchNextPage: vi.fn(),
        isFetchingNextPage: false,
        isRefetching: false,
        refetch: vi.fn(),
        ...overrides,
    } as unknown as ReturnType<typeof useNotificationsListQuery>)

describe('useNotificationsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useMarkNotificationsAsReadMutation).mockReturnValue({
            markAsRead: mockMarkAsRead,
        })
        vi.mocked(useInboxStatus).mockReturnValue({
            hasUnreadItems: true,
            hasUnreadInboxItems: false,
            hasUnreadNotifications: true,
            unreadInboxCount: 0,
        })
    })

    it('does not mark notifications as read while the screen is mounted', () => {
        mockList([notification('42'), notification('41')])

        renderHook(() => useNotificationsScreen())

        expect(mockMarkAsRead).not.toHaveBeenCalled()
    })

    it('marks the latest notification as read on unmount', () => {
        mockList([notification('42'), notification('41')])

        const { unmount } = renderHook(() => useNotificationsScreen())
        unmount()

        expect(mockMarkAsRead).toHaveBeenCalledTimes(1)
        expect(mockMarkAsRead).toHaveBeenCalledWith(42)
    })

    it('does not mark as read on unmount when there are no unread notifications', () => {
        vi.mocked(useInboxStatus).mockReturnValue({
            hasUnreadItems: false,
            hasUnreadInboxItems: false,
            hasUnreadNotifications: false,
            unreadInboxCount: 0,
        })
        mockList([notification('42')])

        const { unmount } = renderHook(() => useNotificationsScreen())
        unmount()

        expect(mockMarkAsRead).not.toHaveBeenCalled()
    })

    it('refetches the notifications list when refresh is triggered', () => {
        const mockRefetch = vi.fn()
        mockList([notification('42')], { refetch: mockRefetch })

        const { result } = renderHook(() => useNotificationsScreen())

        act(() => {
            result.current.refetch()
        })

        expect(mockRefetch).toHaveBeenCalledTimes(1)
    })

    it('surfaces the refetching state of the notifications query', () => {
        mockList([notification('42')], { isRefetching: true })

        const { result } = renderHook(() => useNotificationsScreen())

        expect(result.current.isRefetching).toBe(true)
    })

    it('does not mark as read on unmount when the list is empty', () => {
        mockList([])

        const { unmount } = renderHook(() => useNotificationsScreen())
        unmount()

        expect(mockMarkAsRead).not.toHaveBeenCalled()
    })
})

describe('shouldRevealNewest', () => {
    const THRESHOLD = 200

    it('reveals a newly-arrived notification when near the top', () => {
        expect(shouldRevealNewest('41', '42', 0, THRESHOLD)).toBe(true)
    })

    it('holds position when the user is scrolled past the threshold', () => {
        expect(shouldRevealNewest('41', '42', 500, THRESHOLD)).toBe(false)
    })

    it('does nothing when the newest notification is unchanged', () => {
        expect(shouldRevealNewest('42', '42', 0, THRESHOLD)).toBe(false)
    })

    it('skips the initial load (no previous newest id)', () => {
        expect(shouldRevealNewest(undefined, '42', 0, THRESHOLD)).toBe(false)
    })

    it('does nothing when the list becomes empty', () => {
        expect(shouldRevealNewest('42', undefined, 0, THRESHOLD)).toBe(false)
    })

    it('reveals exactly at the threshold boundary', () => {
        expect(shouldRevealNewest('41', '42', THRESHOLD, THRESHOLD)).toBe(true)
    })
})
