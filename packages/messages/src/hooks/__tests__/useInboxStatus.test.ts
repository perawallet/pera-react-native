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

import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@perawallet/wallet-extension-platform'
import { useInboxStatus } from '../useInboxStatus'
import { fetchNotificationStatus } from '../../api/notifications'
import { useInboxQuery } from '../useInboxQuery'
import { useDeviceID } from '@perawallet/wallet-core-device'

vi.mock('../../api/notifications', () => ({
    fetchNotificationStatus: vi.fn(),
}))

vi.mock('../useInboxQuery', () => ({
    useInboxQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-device')>()
    return {
        ...actual,
        useDeviceID: vi.fn().mockReturnValue('test-device-id'),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn().mockReturnValue({ network: 'test-network' }),
}))

const mockInbox = (items: number) =>
    vi.mocked(useInboxQuery).mockReturnValue({
        data: Array.from({ length: items }, () => ({})),
    } as unknown as ReturnType<typeof useInboxQuery>)

describe('useInboxStatus', () => {
    it('reports an unread notification with strict booleans and a zero inbox count', async () => {
        vi.mocked(fetchNotificationStatus).mockResolvedValue({
            has_new_notification: true,
        })
        mockInbox(0)

        const { result } = renderHook(() => useInboxStatus(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.hasUnreadNotifications).toBe(true)
        })

        expect(fetchNotificationStatus).toHaveBeenCalledWith(
            'test-network',
            'test-device-id',
        )
        expect(result.current.hasUnreadItems).toBe(true)
        expect(result.current.hasUnreadNotifications).toBe(true)
        expect(result.current.hasUnreadInboxItems).toBe(false)
        expect(result.current.unreadInboxCount).toBe(0)
    })

    it('derives the inbox count and booleans from inbox items', async () => {
        vi.mocked(fetchNotificationStatus).mockResolvedValue({
            has_new_notification: false,
        })
        mockInbox(3)

        const { result } = renderHook(() => useInboxStatus(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.unreadInboxCount).toBe(3)
        })

        expect(result.current.hasUnreadInboxItems).toBe(true)
        expect(result.current.hasUnreadItems).toBe(true)
        expect(result.current.hasUnreadNotifications).toBe(false)
    })

    it('returns strict false/0 defaults when deviceID is missing', () => {
        vi.mocked(useDeviceID).mockReturnValueOnce(null)
        vi.mocked(fetchNotificationStatus).mockClear()
        mockInbox(0)

        const { result } = renderHook(() => useInboxStatus(), {
            wrapper: createWrapper(),
        })

        expect(fetchNotificationStatus).not.toHaveBeenCalled()
        expect(result.current.hasUnreadItems).toBe(false)
        expect(result.current.hasUnreadInboxItems).toBe(false)
        expect(result.current.hasUnreadNotifications).toBe(false)
        expect(result.current.unreadInboxCount).toBe(0)
        // Lock the contract: never leak truthy/falsy non-booleans or counts.
        expect(typeof result.current.hasUnreadItems).toBe('boolean')
        expect(typeof result.current.hasUnreadInboxItems).toBe('boolean')
        expect(typeof result.current.hasUnreadNotifications).toBe('boolean')
        expect(typeof result.current.unreadInboxCount).toBe('number')
    })
})
