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
import { createWrapper } from '../../../test-utils'
import { useNotificationsListQuery } from '../useNotificationsListQuery'
import { fetchNotificationList } from '../endpoints'

vi.mock('../endpoints', () => ({
    fetchNotificationList: vi.fn(),
}))

vi.mock('../../../device', () => ({
    useDeviceID: vi.fn().mockReturnValue('test-device-id'),
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
                    title: 'Test Title',
                    message: 'Test Message',
                    creation_datetime: mockDate.toISOString(),
                    metadata: { key: 'value' },
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
                title: 'Test Title',
                message: 'Test Message',
                createdAt: mockDate,
                metadata: { key: 'value' },
            },
        ])
    })
})
