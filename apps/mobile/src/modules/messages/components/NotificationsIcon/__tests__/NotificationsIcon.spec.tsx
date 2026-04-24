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
import { NotificationsIcon } from '../NotificationsIcon'
import { useInboxStatus } from '@perawallet/wallet-core-messages'

const mockNavigate = vi.fn()
vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            navigate: mockNavigate,
        }),
    }
})

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxStatus: vi.fn(() => ({
        hasUnreadInboxItems: 0,
        hasUnreadNotifications: false,
    })),
}))

describe('NotificationsIcon', () => {
    it('renders inbox icon with no badge when nothing is unread', () => {
        const { getByTestId, queryByTestId } = render(<NotificationsIcon />)
        expect(getByTestId('icon-inbox')).toBeTruthy()
        expect(queryByTestId('notification-badge')).toBeNull()
        expect(queryByTestId('notification-count-badge')).toBeNull()
    })

    it('renders a dot badge when only notifications are unread', () => {
        vi.mocked(useInboxStatus).mockReturnValue({
            hasUnreadInboxItems: 0,
            hasUnreadNotifications: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const { getByTestId, queryByTestId } = render(<NotificationsIcon />)
        expect(getByTestId('icon-inbox')).toBeTruthy()
        expect(getByTestId('notification-badge')).toBeTruthy()
        expect(queryByTestId('notification-count-badge')).toBeNull()
    })

    it('renders a count badge with the inbox count when inbox has unread items', () => {
        vi.mocked(useInboxStatus).mockReturnValue({
            hasUnreadInboxItems: 3,
            hasUnreadNotifications: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const { getByTestId, queryByTestId, getByText } = render(
            <NotificationsIcon />,
        )
        expect(getByTestId('notification-count-badge')).toBeTruthy()
        expect(getByText('3')).toBeTruthy()
        expect(queryByTestId('notification-badge')).toBeNull()
    })

    it('prefers the count badge over the dot when both inbox and notifications are unread', () => {
        vi.mocked(useInboxStatus).mockReturnValue({
            hasUnreadInboxItems: 2,
            hasUnreadNotifications: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const { getByTestId, queryByTestId } = render(<NotificationsIcon />)
        expect(getByTestId('notification-count-badge')).toBeTruthy()
        expect(queryByTestId('notification-badge')).toBeNull()
    })

    it('caps the displayed count at 9+', () => {
        vi.mocked(useInboxStatus).mockReturnValue({
            hasUnreadInboxItems: 250,
            hasUnreadNotifications: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const { getByText } = render(<NotificationsIcon />)
        expect(getByText('9+')).toBeTruthy()
    })

    it('navigates to Messages screen when pressed', () => {
        const { getByRole } = render(<NotificationsIcon />)

        fireEvent.click(getByRole('button'))

        expect(mockNavigate).toHaveBeenCalledWith('Messages')
    })
})
