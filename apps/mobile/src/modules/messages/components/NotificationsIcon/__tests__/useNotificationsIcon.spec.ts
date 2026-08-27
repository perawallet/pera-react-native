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
import { useNotificationsIcon } from '../useNotificationsIcon'
import { useInboxStatus } from '@perawallet/wallet-core-messages'
import { useSpotBannersQuery } from '@perawallet/wallet-core-banners'
import { useNavigation } from '@react-navigation/native'
import { trackEvent } from '@analytics'

const mockNavigate = vi.fn()

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxStatus: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-banners', () => ({
    useSpotBannersQuery: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(),
}))

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    HomeEvent: { Notification: 'notification' },
}))

const mockStatus = ({
    unreadInboxCount = 0,
    hasUnreadNotifications = false,
    isUnavailableOnNetwork = false,
} = {}) => {
    vi.mocked(useInboxStatus).mockReturnValue({
        hasUnreadItems: unreadInboxCount > 0 || hasUnreadNotifications,
        hasUnreadInboxItems: unreadInboxCount > 0,
        hasUnreadNotifications,
        unreadInboxCount,
        isUnavailableOnNetwork,
    })
}

describe('useNotificationsIcon', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useNavigation).mockReturnValue({
            navigate: mockNavigate,
        } as unknown as ReturnType<typeof useNavigation>)
        mockStatus()
        vi.mocked(useSpotBannersQuery).mockReturnValue({
            spotBanners: [],
        } as unknown as ReturnType<typeof useSpotBannersQuery>)
    })

    it('shows the count badge when there are unread inbox items', () => {
        mockStatus({ unreadInboxCount: 3 })

        const { result } = renderHook(() => useNotificationsIcon())

        expect(result.current.showCountBadge).toBe(true)
        expect(result.current.countLabel).toBe('3')
    })

    it('shows the dot badge when notifications are unread and inbox is empty', () => {
        mockStatus({ hasUnreadNotifications: true })

        const { result } = renderHook(() => useNotificationsIcon())

        expect(result.current.showDotBadge).toBe(true)
        expect(result.current.showCountBadge).toBe(false)
    })

    it('suppresses both badges when the network is unavailable, even with unread state', () => {
        mockStatus({
            unreadInboxCount: 3,
            hasUnreadNotifications: true,
            isUnavailableOnNetwork: true,
        })

        const { result } = renderHook(() => useNotificationsIcon())

        expect(result.current.showCountBadge).toBe(false)
        expect(result.current.showDotBadge).toBe(false)
    })

    it('still shows the dot badge for spot banners when the network is unavailable', () => {
        mockStatus({ isUnavailableOnNetwork: true })
        vi.mocked(useSpotBannersQuery).mockReturnValue({
            spotBanners: [{ id: 'banner-1' }],
        } as unknown as ReturnType<typeof useSpotBannersQuery>)

        const { result } = renderHook(() => useNotificationsIcon())

        expect(result.current.showDotBadge).toBe(true)
    })

    it('navigates to Messages and tracks the event on press', () => {
        const { result } = renderHook(() => useNotificationsIcon())

        act(() => {
            result.current.goToNotifications()
        })

        expect(mockNavigate).toHaveBeenCalledWith('Messages')
        expect(trackEvent).toHaveBeenCalled()
    })
})
