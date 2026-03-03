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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { NotificationItem } from '../NotificationItem'
import type { PeraNotification } from '@perawallet/wallet-core-messages'

const mockHandleNotificationPress = vi.fn()

vi.mock('@modules/messages/hooks', () => ({
    useNotificationPress: () => ({
        handleNotificationPress: mockHandleNotificationPress,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    formatRelativeTime: vi.fn(date => `formatted-${date.toISOString()}`),
    createLazyStore: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(() => ({
        addSignRequest: vi.fn(),
    })),
}))

describe('NotificationItem', () => {
    const mockNotification: PeraNotification = {
        id: '1',
        accountAddress: 'TESTADDR123',
        message: 'Test message',
        url: 'perawallet://home',
        createdAt: new Date('2025-01-27T12:00:00Z'),
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders message and formatted time', () => {
        const { getByText } = render(
            <NotificationItem item={mockNotification} />,
        )

        expect(getByText('Test message')).toBeTruthy()
        expect(getByText('formatted-2025-01-27T12:00:00.000Z')).toBeTruthy()
    })

    it('renders default bell icon when no icon is provided', () => {
        const { getByTestId } = render(
            <NotificationItem item={mockNotification} />,
        )

        expect(getByTestId('icon-bell')).toBeTruthy()
    })

    it('renders image when icon logo is provided', () => {
        const notificationWithIcon: PeraNotification = {
            ...mockNotification,
            icon: {
                logo: 'https://example.com/image.png',
                shape: 'rectangle',
            },
        }

        const { getByRole } = render(
            <NotificationItem item={notificationWithIcon} />,
        )

        expect(getByRole('img')).toBeTruthy()
    })

    it('renders circular image when shape is circle', () => {
        const circularNotification: PeraNotification = {
            ...mockNotification,
            icon: {
                logo: 'https://example.com/image.png',
                shape: 'circle',
            },
        }

        const { getByRole } = render(
            <NotificationItem item={circularNotification} />,
        )

        expect(getByRole('img')).toBeTruthy()
    })

    it('calls handleNotificationPress when pressed', () => {
        const { getByText } = render(
            <NotificationItem item={mockNotification} />,
        )

        fireEvent.click(getByText('Test message'))
        expect(mockHandleNotificationPress).toHaveBeenCalledWith(
            mockNotification,
        )
    })
})
