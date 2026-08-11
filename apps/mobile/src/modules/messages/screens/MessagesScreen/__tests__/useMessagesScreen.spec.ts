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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRoute } from '@react-navigation/native'
import {
    useInboxQuery,
    useInboxStatus,
    type InboxItem,
} from '@perawallet/wallet-core-messages'
import { useMessagesScreen } from '../useMessagesScreen'

vi.mock('@react-navigation/native', () => ({
    useRoute: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxQuery: vi.fn(),
    useInboxStatus: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: vi.fn() }),
}))

vi.mock('@modules/messages/components/NotificationSettingsContent', () => ({
    NotificationSettingsContent: () => null,
}))

const signItem = {
    type: 'multisig_sign',
    data: { id: 'sign-1' },
} as unknown as InboxItem

const mockRoute = (initialTab?: 'Inbox' | 'Notifications') => {
    vi.mocked(useRoute).mockReturnValue({
        key: 'MessagesHome',
        name: 'MessagesHome',
        params: initialTab ? { initialTab } : undefined,
    } as unknown as ReturnType<typeof useRoute>)
}

const mockInbox = (data: InboxItem[] | undefined) => {
    vi.mocked(useInboxQuery).mockReturnValue({
        data,
    } as unknown as ReturnType<typeof useInboxQuery>)
}

const mockStatus = ({
    hasUnreadInboxItems = false,
    hasUnreadNotifications = false,
} = {}) => {
    vi.mocked(useInboxStatus).mockReturnValue({
        hasUnreadItems: hasUnreadInboxItems || hasUnreadNotifications,
        hasUnreadInboxItems,
        hasUnreadNotifications,
        unreadInboxCount: hasUnreadInboxItems ? 1 : 0,
    })
}

describe('useMessagesScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRoute()
        mockInbox([])
        mockStatus()
    })

    it('defaults to Notifications when the inbox is empty', () => {
        const { result } = renderHook(() => useMessagesScreen())

        expect(result.current.initialRouteName).toBe('Notifications')
        expect(result.current.activeTab).toBe('Notifications')
    })

    it('defaults to Notifications when the inbox query has no data (e.g. watch-only wallet)', () => {
        mockInbox(undefined)

        const { result } = renderHook(() => useMessagesScreen())

        expect(result.current.initialRouteName).toBe('Notifications')
    })

    it('defaults to Inbox when the inbox has items', () => {
        mockInbox([signItem])
        mockStatus({ hasUnreadInboxItems: true })

        const { result } = renderHook(() => useMessagesScreen())

        expect(result.current.initialRouteName).toBe('Inbox')
    })

    it('defaults to Notifications when inbox items are all read and notifications are unread', () => {
        mockInbox([signItem])
        mockStatus({
            hasUnreadInboxItems: false,
            hasUnreadNotifications: true,
        })

        const { result } = renderHook(() => useMessagesScreen())

        expect(result.current.initialRouteName).toBe('Notifications')
    })

    it('honors an explicit initialTab param over the empty-inbox default', () => {
        mockRoute('Inbox')

        const { result } = renderHook(() => useMessagesScreen())

        expect(result.current.initialRouteName).toBe('Inbox')
    })

    it('keeps the mount-time decision when inbox data changes later', () => {
        mockInbox([signItem])
        mockStatus({ hasUnreadInboxItems: true })

        const { result, rerender } = renderHook(() => useMessagesScreen())
        mockInbox([])
        mockStatus()
        rerender()

        expect(result.current.initialRouteName).toBe('Inbox')
    })

    it('shows the tab badges only for the inactive unread tab', () => {
        mockInbox([signItem])
        mockStatus({
            hasUnreadInboxItems: true,
            hasUnreadNotifications: true,
        })

        const { result } = renderHook(() => useMessagesScreen())

        expect(result.current.activeTab).toBe('Inbox')
        expect(result.current.showInboxBadge).toBe(false)
        expect(result.current.showNotificationsBadge).toBe(true)
    })
})
