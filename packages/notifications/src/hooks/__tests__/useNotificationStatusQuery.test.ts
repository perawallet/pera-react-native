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
import { createWrapper } from '@perawallet/wallet-core-platform-integration'
import { useNotificationStatus } from '../useNotificationStatusQuery'
import { fetchNotificationStatus } from '../endpoints'

vi.mock('../endpoints', () => ({
    fetchNotificationStatus: vi.fn(),
}))

vi.mock(
    '@perawallet/wallet-core-platform-integration',
    async importOriginal => {
        const actual =
            await importOriginal<
                typeof import('@perawallet/wallet-core-platform-integration')
            >()
        return {
            ...actual,
            useDeviceID: vi.fn().mockReturnValue('test-device-id'),
            useNetwork: vi.fn().mockReturnValue({ network: 'test-network' }),
        }
    },
)

describe('useNotificationStatus', () => {
    it('should fetch notification status and return hasNewNotification', async () => {
        const mockResponse = {
            has_new_notification: true,
        }
        vi.mocked(fetchNotificationStatus).mockResolvedValue(mockResponse)

        const { result } = renderHook(() => useNotificationStatus(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(fetchNotificationStatus).toHaveBeenCalledWith(
            'test-network',
            'test-device-id',
        )
        expect(result.current.data).toEqual({ hasNewNotification: true })
    })
})
