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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { NotificationsScreen } from '../NotificationsScreen'
import { useNotificationsListQuery } from '@perawallet/wallet-core-notifications'

vi.mock('@perawallet/wallet-core-notifications', () => ({
    useNotificationsListQuery: vi.fn(() => ({
        data: [],
        isPending: false,
        fetchNextPage: vi.fn(),
        isFetchingNextPage: false,
        isRefetching: false,
        refetch: vi.fn(),
    })),
}))

describe('NotificationsScreen', () => {
    it('renders loading state when pending', () => {
        vi.mocked(useNotificationsListQuery).mockReturnValue({
            isPending: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const { getAllByTestId } = render(<NotificationsScreen />)
        expect(getAllByTestId('RNESkeleton').length).toBeGreaterThan(0)
    })

    it('renders empty state when no notifications', () => {
        vi.mocked(useNotificationsListQuery).mockReturnValue({
            isPending: false,
            data: [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const { getByText } = render(<NotificationsScreen />)
        expect(getByText('notifications.empty_title')).toBeTruthy()
    })

    it('renders notifications list when data is available', () => {
        const mockNotifications = [
            {
                id: '1',
                message: 'Notification 1',
                createdAt: '2025-01-27T12:00:00Z',
                metadata: {},
            },
            {
                id: '2',
                message: 'Notification 2',
                createdAt: '2025-01-27T12:05:00Z',
                metadata: {},
            },
        ]

        vi.mocked(useNotificationsListQuery).mockReturnValue({
            isPending: false,
            data: mockNotifications,
            fetchNextPage: vi.fn(),
            isFetchingNextPage: false,
            isRefetching: false,
            refetch: vi.fn(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const { getByText } = render(<NotificationsScreen />)

        expect(getByText('Notification 1')).toBeTruthy()
        expect(getByText('Notification 2')).toBeTruthy()
    })
})
