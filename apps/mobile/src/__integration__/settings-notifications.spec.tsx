/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'

// Device registration reads `deviceInfo.getAppVersion()`, which only the
// in-memory driver provides (same as account-management.spec.tsx).
vi.unmock('@perawallet/wallet-extension-platform-driver')
vi.unmock('@perawallet/wallet-extension-platform')

import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useDeviceStore,
    type DeviceRegistrationRequest,
} from '@perawallet/wallet-core-device'
import { mockRegisterDevice } from '@perawallet/wallet-core-device/test-handlers'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { clearAccountNotificationToggleGuardForTests } from '@hooks/useAccountNotificationToggle'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { getSwitchControl } from '@test-utils/rnw'
import { SettingsNotificationsScreen } from '@modules/settings/screens/SettingsNotificationsScreen/SettingsNotificationsScreen'
import { addressOf } from './__fixtures__/accounts'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const TRADING: WalletAccount = {
    id: 'trading',
    custody: { kind: 'watch' },
    chains: { algorand: { address: ALGO25_TEST_ADDRESS } },
    name: 'Trading',
}

const SAVINGS: WalletAccount = {
    id: 'savings',
    custody: { kind: 'watch' },
    chains: { algorand: { address: HD_TEST_ADDRESS } },
    name: 'Savings',
}

// Rows carry no testID, so the switch is found from the account name up to
// the nearest ancestor holding one.
const accountSwitch = (accountName: string): HTMLInputElement => {
    let row: HTMLElement | null = screen.getByText(accountName)
    while (row && !row.querySelector('input[role="switch"]')) {
        row = row.parentElement
    }
    if (!row) throw new Error(`No switch row for "${accountName}"`)
    return getSwitchControl(row)
}

const isAccountEnabled = (account: WalletAccount): boolean =>
    renderHook(() =>
        useNotificationPreferences(),
    ).result.current.isAccountEnabled(addressOf(account))

const resetNotificationPreferences = () => {
    const { result } = renderHook(() => useNotificationPreferences())
    result.current.disabledAccounts.forEach(address => {
        result.current.setAccountEnabled(address, true)
    })
}

const DEVICE = { id: 'test-device-id', platform: 'ios' } as const

const recordRegistrations = (): DeviceRegistrationRequest[] => {
    const registrations: DeviceRegistrationRequest[] = []
    server.events.on('request:start', async ({ request }) => {
        if (request.method === 'POST' && request.url.includes('/devices')) {
            registrations.push(await request.clone().json())
        }
    })
    return registrations
}

const renderScreen = () =>
    renderWithNavigation(SettingsNotificationsScreen, 'SettingsNotifications')

describe('Flow: Settings → Notifications', () => {
    beforeEach(() => {
        resetNotificationPreferences()
        useAccountsStore.getState().setAccounts([TRADING, SAVINGS])
        useDeviceStore.getState().setDeviceID('live', 'test-device-id')
        useDeviceStore.getState().setDeviceID('developer', 'test-device-id')
    })

    afterEach(() => {
        server.events.removeAllListeners()
        clearAccountNotificationToggleGuardForTests()
        useAccountsStore.getState().setAccounts([])
        useDeviceStore.getState().resetState()
        resetNotificationPreferences()
    })

    it('Given both accounts receive notifications, when the user switches one off, then the device is re-registered with it muted and the preference persists', async () => {
        const registrations = recordRegistrations()
        server.use(mockRegisterDevice({ response: DEVICE }))
        renderScreen()
        expect(accountSwitch('Trading').checked).toBe(true)

        fireEvent.click(accountSwitch('Trading'))

        await waitFor(() => {
            expect(registrations).toHaveLength(1)
        })
        await waitFor(() => {
            expect(accountSwitch('Trading').disabled).toBe(false)
        })
        expect(accountSwitch('Trading').checked).toBe(false)
        expect(accountSwitch('Savings').checked).toBe(true)
        expect(isAccountEnabled(TRADING)).toBe(false)
        expect(isAccountEnabled(SAVINGS)).toBe(true)
        expect(registrations[0].accounts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    address: addressOf(TRADING),
                    receive_notifications: false,
                }),
                expect.objectContaining({
                    address: addressOf(SAVINGS),
                    receive_notifications: true,
                }),
            ]),
        )
    })

    it('Given the backend rejects the registration, when the user switches an account off, then the switch and the stored preference roll back to enabled', async () => {
        const registrations = recordRegistrations()
        server.use(mockRegisterDevice({ response: DEVICE, status: 500 }))
        renderScreen()

        fireEvent.click(accountSwitch('Trading'))

        await waitFor(() => {
            expect(registrations).toHaveLength(1)
        })
        await waitFor(() => {
            expect(accountSwitch('Trading').disabled).toBe(false)
        })
        expect(accountSwitch('Trading').checked).toBe(true)
        expect(isAccountEnabled(TRADING)).toBe(true)
    })
})
