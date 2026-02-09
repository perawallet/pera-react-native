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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsNotificationsScreen } from '../SettingsNotificationsScreen'
import { useSettingsNotificationsScreen } from '../useSettingsNotificationsScreen'

vi.mock('../useSettingsNotificationsScreen', () => ({
    useSettingsNotificationsScreen: vi.fn(() => ({
        isSystemNotificationEnabled: true,
        isSystemNotificationLoading: false,
        accounts: [],
        handleSystemNotificationToggle: vi.fn(),
        handleAccountNotificationToggle: vi.fn(),
        isAccountNotificationEnabled: vi.fn(() => true),
    })),
}))

describe('SettingsNotificationsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders system notifications section', () => {
        const { getByText } = render(<SettingsNotificationsScreen />)

        expect(
            getByText('settings.notifications.push_notifications'),
        ).toBeTruthy()
    })

    it('renders account notifications section', () => {
        const { getByText } = render(<SettingsNotificationsScreen />)

        expect(
            getByText('settings.notifications.account_notifications'),
        ).toBeTruthy()
    })

    it('shows empty state when no accounts', () => {
        const { getByText } = render(<SettingsNotificationsScreen />)

        expect(getByText('settings.notifications.no_accounts')).toBeTruthy()
        expect(
            getByText('settings.notifications.no_accounts_body'),
        ).toBeTruthy()
    })

    it('renders accounts when available', () => {
        const mockAccount = {
            address: 'ADDRESS1',
            name: 'Account 1',
        }

        vi.mocked(useSettingsNotificationsScreen).mockReturnValueOnce({
            isSystemNotificationEnabled: true,
            isSystemNotificationLoading: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            accounts: [mockAccount] as any,
            handleSystemNotificationToggle: vi.fn(),
            handleAccountNotificationToggle: vi.fn(),
            isAccountNotificationEnabled: vi.fn(() => true),
        })

        const { getByText } = render(<SettingsNotificationsScreen />)

        expect(getByText('Account 1')).toBeTruthy()
    })

    it('calls handleSystemNotificationToggle when system switch is toggled', () => {
        const handleSystemNotificationToggle = vi.fn()

        vi.mocked(useSettingsNotificationsScreen).mockReturnValueOnce({
            isSystemNotificationEnabled: true,
            isSystemNotificationLoading: false,
            accounts: [],
            handleSystemNotificationToggle,
            handleAccountNotificationToggle: vi.fn(),
            isAccountNotificationEnabled: vi.fn(() => true),
        })

        const { getByTestId } = render(<SettingsNotificationsScreen />)
        const switchBtn = getByTestId('PWSwitch')

        fireEvent.click(switchBtn)

        expect(handleSystemNotificationToggle).toHaveBeenCalled()
    })
})
