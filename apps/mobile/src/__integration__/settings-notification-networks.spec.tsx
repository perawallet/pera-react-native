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

// Same platform and chain setup as settings-notifications.spec.tsx and
// device-registration-v4.spec.tsx: the in-memory driver serves
// `deviceInfo.getAppVersion()`, and config decides which chains register.
vi.unmock('@perawallet/wallet-extension-platform-driver')
vi.unmock('@perawallet/wallet-extension-platform')

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: {
                enabled: ['algorand', 'ethereum', 'base'],
                capabilities: {},
            },
        },
    }
})

import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    clearRegistrationQueuesForTests,
    useDeviceStore,
    type DeviceRegistrationRequest,
} from '@perawallet/wallet-core-device'
import { mockRegisterDevice } from '@perawallet/wallet-core-device/test-handlers'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { clearAccountNotificationToggleGuardForTests } from '@hooks/useAccountNotificationToggle'
import { clearNetworkNotificationToggleGuardForTests } from '@modules/settings/hooks/useNetworkNotificationToggle'
import { server, http, HttpResponse } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { getSwitchControl } from '@test-utils/rnw'
import { SettingsNotificationsScreen } from '@modules/settings/screens/SettingsNotificationsScreen/SettingsNotificationsScreen'
import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'

const HD_ACCOUNT: WalletAccount = {
    id: 'hd-1',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: {
        algorand: { address: HD_TEST_ADDRESS, keyPairId: 'hd-1-key' },
        ethereum: { address: ETH_ADDRESS, keyPairId: 'hd-1-eth-key' },
    },
    name: 'HD account',
}

const networkSwitch = (chainId: string): HTMLInputElement =>
    getSwitchControl(
        screen.getByTestId(`settings_notifications_network_${chainId}`),
    )

// Rows carry no testID, so the account's switch is found from its name up to
// the nearest ancestor holding one.
const accountSwitch = (accountName: string): HTMLInputElement => {
    let row: HTMLElement | null = screen.getByText(accountName)
    while (row && !row.querySelector('input[role="switch"]')) {
        row = row.parentElement
    }
    if (!row) throw new Error(`No switch row for "${accountName}"`)
    return getSwitchControl(row)
}

const resetNotificationPreferences = () => {
    const { result } = renderHook(() => useNotificationPreferences())
    result.current.disabledAccounts.forEach(address => {
        result.current.setAccountEnabled(address, true)
    })
}

const recordRegistrations = (): DeviceRegistrationRequest[] => {
    const registrations: DeviceRegistrationRequest[] = []
    server.events.on('request:start', async ({ request }) => {
        if (request.method === 'POST' && request.url.includes('/devices')) {
            registrations.push(await request.clone().json())
        }
    })
    return registrations
}

const DEVICE = { id: 'test-device-id', platform: 'ios' } as const
const ETHEREUM_MAINNET = 'eip155:1'

const renderScreen = () =>
    renderWithNavigation(SettingsNotificationsScreen, 'SettingsNotifications')

describe('Flow: Settings → Notifications → Networks', () => {
    beforeEach(() => {
        resetNotificationPreferences()
        useAccountsStore.getState().setAccounts([HD_ACCOUNT])
        useDeviceStore.getState().setDeviceID('live', 'test-device-id')
        useDeviceStore.getState().setDeviceID('developer', 'test-device-id')
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_device_registration_v4', true)
    })

    afterEach(() => {
        server.events.removeAllListeners()
        clearAccountNotificationToggleGuardForTests()
        clearNetworkNotificationToggleGuardForTests()
        clearRegistrationQueuesForTests()
        useAccountsStore.getState().setAccounts([])
        useDeviceStore.getState().resetState()
        useRemoteConfigStore.getState().resetState()
        resetNotificationPreferences()
    })

    it('Given both networks are on, when the user switches Ethereum off and back on, then each registration carries the muted chains and the accounts keep receiving', async () => {
        const registrations = recordRegistrations()
        server.use(mockRegisterDevice({ response: DEVICE }))
        renderScreen()
        expect(networkSwitch('ethereum').checked).toBe(true)
        expect(networkSwitch('base').checked).toBe(true)

        fireEvent.click(networkSwitch('ethereum'))

        await waitFor(() => {
            expect(registrations).toHaveLength(1)
        })
        await waitFor(() => {
            expect(networkSwitch('ethereum').disabled).toBe(false)
        })
        expect(networkSwitch('ethereum').checked).toBe(false)
        expect(networkSwitch('base').checked).toBe(true)
        expect(registrations[0].muted_chains).toEqual([ETHEREUM_MAINNET])
        expect(
            registrations[0].accounts.map(item => item.receive_notifications),
        ).toEqual([true, true])
        expect(useDeviceStore.getState().mutedChainIds).toEqual(['ethereum'])

        fireEvent.click(networkSwitch('ethereum'))

        await waitFor(() => {
            expect(registrations).toHaveLength(2)
        })
        await waitFor(() => {
            expect(networkSwitch('ethereum').checked).toBe(true)
        })
        expect(registrations[1].muted_chains).toEqual([])
        expect(useDeviceStore.getState().mutedChainIds).toEqual([])
    })

    it('Given the backend rejects the registration, when the user switches Ethereum off, then the switch and the stored mute roll back to on', async () => {
        const registrations = recordRegistrations()
        server.use(mockRegisterDevice({ response: DEVICE, status: 500 }))
        renderScreen()

        fireEvent.click(networkSwitch('ethereum'))

        await waitFor(() => {
            expect(registrations).toHaveLength(1)
        })
        await waitFor(() => {
            expect(networkSwitch('ethereum').disabled).toBe(false)
        })
        expect(networkSwitch('ethereum').checked).toBe(true)
        expect(useDeviceStore.getState().mutedChainIds).toEqual([])
    })

    it('Given Ethereum is muted, when the user switches the account off, then the registration mutes the account and still mutes Ethereum', async () => {
        const registrations: DeviceRegistrationRequest[] = []
        server.use(
            http.post('*/api/v4/devices/', async ({ request }) => {
                registrations.push(
                    (await request.json()) as DeviceRegistrationRequest,
                )
                return HttpResponse.json(DEVICE)
            }),
        )
        useDeviceStore.getState().setChainMuted('ethereum', true)
        renderScreen()
        expect(networkSwitch('ethereum').checked).toBe(false)

        fireEvent.click(accountSwitch('HD account'))

        await waitFor(() => {
            expect(registrations).toHaveLength(1)
        })
        expect(registrations[0].muted_chains).toEqual([ETHEREUM_MAINNET])
        expect(
            registrations[0].accounts.map(item => item.receive_notifications),
        ).toEqual([false, false])
    })
})
