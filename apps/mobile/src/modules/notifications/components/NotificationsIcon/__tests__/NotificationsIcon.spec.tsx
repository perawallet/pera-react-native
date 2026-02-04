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
import { useNotificationStatus } from '@perawallet/wallet-core-notifications'

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

vi.mock('@perawallet/wallet-core-notifications', () => ({
    useNotificationStatus: vi.fn(() => ({
        data: { hasNewNotification: false },
    })),
}))

describe('NotificationsIcon', () => {
    it('renders bell icon when there are no new notifications', () => {
        const { getByTestId, queryByTestId } = render(<NotificationsIcon />)
        expect(getByTestId('icon-inbox')).toBeTruthy()
        expect(queryByTestId('notification-badge')).toBeNull()
    })

    it('renders bell-with-badge icon when there are new notifications', () => {
        vi.mocked(useNotificationStatus).mockReturnValue({
            data: { hasNewNotification: true },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const { getByTestId } = render(<NotificationsIcon />)
        expect(getByTestId('icon-inbox')).toBeTruthy()
        expect(getByTestId('notification-badge')).toBeTruthy()
    })

    it('navigates to Notifications screen when pressed', () => {
        const { getByRole } = render(<NotificationsIcon />)

        fireEvent.click(getByRole('button'))

        expect(mockNavigate).toHaveBeenCalledWith('Notifications')
    })
})
