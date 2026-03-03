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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@perawallet/wallet-extension-platform'
import { useMarkNotificationsAsReadMutation } from '../useMarkNotificationsAsReadMutation'
import { updateLastSeenNotification } from '../../api/notifications'

vi.mock('../../api/notifications', () => ({
    updateLastSeenNotification: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-platform', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-extension-platform')
        >()
    return {
        ...actual,
        useDeviceID: vi.fn().mockReturnValue('test-device-id'),
    }
})

vi.mock('@perawallet/wallet-extension-network', () => ({
    useNetwork: vi.fn().mockReturnValue({ network: 'mainnet' }),
}))

describe('useMarkNotificationsAsReadMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls updateLastSeenNotification with correct parameters', async () => {
        vi.mocked(updateLastSeenNotification).mockResolvedValue(undefined)

        const { result } = renderHook(
            () => useMarkNotificationsAsReadMutation(),
            {
                wrapper: createWrapper(),
            },
        )

        result.current.markAsRead(12345)

        await waitFor(() => {
            expect(updateLastSeenNotification).toHaveBeenCalledWith(
                'mainnet',
                'test-device-id',
                12345,
            )
        })
    })

    it('handles mutation error', async () => {
        const mockError = new Error('Network error')
        vi.mocked(updateLastSeenNotification).mockRejectedValue(mockError)

        const { result } = renderHook(
            () => useMarkNotificationsAsReadMutation(),
            {
                wrapper: createWrapper(),
            },
        )

        result.current.markAsRead(12345)

        await waitFor(() => {
            expect(updateLastSeenNotification).toHaveBeenCalledWith(
                'mainnet',
                'test-device-id',
                12345,
            )
        })
    })
})
