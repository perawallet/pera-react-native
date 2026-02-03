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
import { NotificationItem } from '../NotificationItem'
import { PeraNotification } from '@perawallet/wallet-core-notifications'

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
    const mockNotification = {
        id: '1',
        title: 'Title',
        message: 'Test message',
        createdAt: new Date('2025-01-27T12:00:00Z'),
        metadata: {},
    }

    it('renders message and formatted time', () => {
        const { getByText } = render(
            <NotificationItem item={mockNotification as PeraNotification} />,
        )

        expect(getByText('Test message')).toBeTruthy()
        expect(getByText('formatted-2025-01-27T12:00:00.000Z')).toBeTruthy()
    })

    it('renders default bell icon when no image url is provided', () => {
        const { getByTestId } = render(
            <NotificationItem item={mockNotification as PeraNotification} />,
        )

        expect(getByTestId('icon-bell')).toBeTruthy()
    })

    it('renders image when image_url is provided', () => {
        const notificationWithImage = {
            ...mockNotification,
            metadata: {
                image_url: 'https://example.com/image.png',
            },
        }

        const { getByRole } = render(
            <NotificationItem
                item={notificationWithImage as PeraNotification}
            />,
        )

        expect(getByRole('img')).toBeTruthy()
    })

    it('renders circular image when shape is circle', () => {
        const circularNotification = {
            ...mockNotification,
            metadata: {
                image_url: 'https://example.com/image.png',
                icon: {
                    shape: 'circle',
                },
            },
        }

        const { getByRole } = render(
            <NotificationItem
                item={circularNotification as PeraNotification}
            />,
        )

        expect(getByRole('img')).toBeTruthy()
    })
})
