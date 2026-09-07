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
import { useNetworkStatusStore } from '@modules/network'
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

const mockList = (
    notifications: PeraNotification[],
    overrides: {
        isRefetching?: boolean
        refetch?: () => void
        isUnavailableOnNetwork?: boolean
        isDeviceUnregistered?: boolean
        isPaused?: boolean
        isError?: boolean
    } = {},
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
        useNetworkStatusStore.getState().setHasInternet(true)
        vi.mocked(useMarkNotificationsAsReadMutation).mockReturnValue({
            markAsRead: mockMarkAsRead,
            isUnavailableOnNetwork: false,
        })
        vi.mocked(useInboxStatus).mockReturnValue({
            hasUnreadItems: true,
            hasUnreadInboxItems: false,
            hasUnreadNotifications: true,
            unreadInboxCount: 0,
            isUnavailableOnNetwork: false,
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
            isUnavailableOnNetwork: false,
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

    it('forwards isUnavailableOnNetwork from the notifications list query', () => {
        mockList([], { isUnavailableOnNetwork: true })

        const { result } = renderHook(() => useNotificationsScreen())

        expect(result.current.isUnavailableOnNetwork).toBe(true)
    })

    it('forwards isDeviceUnregistered from the notifications list query', () => {
        mockList([], { isDeviceUnregistered: true })

        const { result } = renderHook(() => useNotificationsScreen())

        expect(result.current.isDeviceUnregistered).toBe(true)
    })

    it('flags offline while the list query is paused', () => {
        mockList([], { isPaused: true })

        const { result } = renderHook(() => useNotificationsScreen())

        expect(result.current.isOffline).toBe(true)
    })

    it('flags offline for an error on a device with no internet', () => {
        useNetworkStatusStore.getState().setHasInternet(false)
        mockList([], { isError: true })

        const { result } = renderHook(() => useNotificationsScreen())

        expect(result.current.isOffline).toBe(true)
    })

    it('keeps an online error as an error, not offline', () => {
        mockList([], { isError: true })

        const { result } = renderHook(() => useNotificationsScreen())

        expect(result.current.isOffline).toBe(false)
        expect(result.current.isError).toBe(true)
    })
})
