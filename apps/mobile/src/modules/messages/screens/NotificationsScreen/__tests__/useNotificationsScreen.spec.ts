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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNotificationsScreen } from '../useNotificationsScreen'
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

const mockList = (notifications: PeraNotification[]) =>
    vi.mocked(useNotificationsListQuery).mockReturnValue({
        data: notifications,
        isPending: false,
        fetchNextPage: vi.fn(),
        isFetchingNextPage: false,
        isRefetching: false,
        refetch: vi.fn(),
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

    it('does not mark as read on unmount when the list is empty', () => {
        mockList([])

        const { unmount } = renderHook(() => useNotificationsScreen())
        unmount()

        expect(mockMarkAsRead).not.toHaveBeenCalled()
    })
})
