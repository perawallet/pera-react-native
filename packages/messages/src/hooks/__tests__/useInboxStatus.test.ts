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

describe('useInboxStatus', () => {
    it('should fetch notification status and return hasUnreadItems', async () => {
        const mockResponse = {
            has_new_notification: true,
        }
        vi.mocked(fetchNotificationStatus).mockResolvedValue(mockResponse)
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxStatus(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.hasUnreadItems).toBe(false)
        })

        expect(fetchNotificationStatus).toHaveBeenCalledWith(
            'test-network',
            'test-device-id',
        )
        expect(result.current.hasUnreadItems).toEqual(false)
        expect(result.current.hasUnreadNotifications).toEqual(false)
        expect(result.current.hasUnreadInboxItems).toBeFalsy()
    })

    it('skips the status fetch when deviceID is missing', async () => {
        vi.mocked(useDeviceID).mockReturnValueOnce(null)
        vi.mocked(fetchNotificationStatus).mockClear()
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxStatus(), {
            wrapper: createWrapper(),
        })

        expect(fetchNotificationStatus).not.toHaveBeenCalled()
        expect(result.current.hasUnreadNotifications).toBe(false)
    })
})
