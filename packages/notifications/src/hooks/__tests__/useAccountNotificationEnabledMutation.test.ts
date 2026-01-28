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
import { createWrapper } from '@perawallet/wallet-core-platform-integration'
import { useAccountNotificationEnabledMutation } from '../useAccountNotificationEnabledMutation'
import { updateNotificationEnabled } from '../endpoints'

vi.mock('../endpoints', () => ({
    updateNotificationEnabled: vi.fn(),
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
            useNetwork: vi.fn().mockReturnValue({ network: 'mainnet' }),
        }
    },
)

describe('useAccountNotificationEnabledMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls updateNotificationEnabled with correct parameters when enabling', async () => {
        vi.mocked(updateNotificationEnabled).mockResolvedValue({
            has_new_notification: false,
        })

        const { result } = renderHook(
            () => useAccountNotificationEnabledMutation(),
            {
                wrapper: createWrapper(),
            },
        )

        result.current.mutate({ accountID: 'test-account', status: true })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(updateNotificationEnabled).toHaveBeenCalledWith(
            'mainnet',
            'test-device-id',
            'test-account',
            true,
        )
    })

    it('calls updateNotificationEnabled with correct parameters when disabling', async () => {
        vi.mocked(updateNotificationEnabled).mockResolvedValue({
            has_new_notification: false,
        })

        const { result } = renderHook(
            () => useAccountNotificationEnabledMutation(),
            {
                wrapper: createWrapper(),
            },
        )

        result.current.mutate({ accountID: 'test-account', status: false })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(updateNotificationEnabled).toHaveBeenCalledWith(
            'mainnet',
            'test-device-id',
            'test-account',
            false,
        )
    })

    it('handles mutation error', async () => {
        const mockError = new Error('Network error')
        vi.mocked(updateNotificationEnabled).mockRejectedValue(mockError)

        const { result } = renderHook(
            () => useAccountNotificationEnabledMutation(),
            {
                wrapper: createWrapper(),
            },
        )

        result.current.mutate({ accountID: 'test-account', status: true })

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(result.current.error).toBe(mockError)
    })
})
