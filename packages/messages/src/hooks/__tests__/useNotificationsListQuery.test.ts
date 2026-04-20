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
import { useNotificationsListQuery } from '../useNotificationsListQuery'
import { fetchNotificationList } from '../../api/notifications'
import { useDeviceID } from '@perawallet/wallet-core-device'

vi.mock('../../api/notifications', () => ({
    fetchNotificationList: vi.fn(),
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

describe('useNotificationsListQuery', () => {
    it('should fetch notifications list and map response', async () => {
        const mockDate = new Date('2023-01-01T00:00:00Z')
        const mockResponse = {
            count: 1,
            next: null,
            previous: null,
            results: [
                {
                    id: '1',
                    account_address: 'TESTADDR123',
                    message: 'Test Message',
                    url: 'perawallet://account-detail?address=TESTADDR123',
                    creation_datetime: mockDate.toISOString(),
                    icon: {
                        logo: 'https://example.com/icon.png',
                        shape: 'circle' as const,
                    },
                },
            ],
        }
        vi.mocked(fetchNotificationList).mockResolvedValue(mockResponse)

        const { result } = renderHook(() => useNotificationsListQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(fetchNotificationList).toHaveBeenCalledWith(
            'test-network',
            'test-device-id',
            '',
        )

        expect(result.current.data).toEqual([
            {
                id: '1',
                accountAddress: 'TESTADDR123',
                message: 'Test Message',
                url: 'perawallet://account-detail?address=TESTADDR123',
                createdAt: mockDate,
                icon: {
                    logo: 'https://example.com/icon.png',
                    shape: 'circle',
                },
            },
        ])
    })

    it('maps a response with no icon to icon: null', async () => {
        const mockResponse = {
            count: 1,
            next: null,
            previous: null,
            results: [
                {
                    id: '2',
                    account_address: 'ADDR2',
                    message: 'No icon',
                    url: 'perawallet://',
                    creation_datetime: new Date().toISOString(),
                },
            ],
        }
        vi.mocked(fetchNotificationList).mockResolvedValue(mockResponse)

        const { result } = renderHook(() => useNotificationsListQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.[0].icon).toBeNull()
    })

    it('does not fetch when deviceID is null', async () => {
        vi.mocked(useDeviceID).mockReturnValueOnce(null)
        vi.mocked(fetchNotificationList).mockClear()

        renderHook(() => useNotificationsListQuery(), {
            wrapper: createWrapper(),
        })

        expect(fetchNotificationList).not.toHaveBeenCalled()
    })
})
