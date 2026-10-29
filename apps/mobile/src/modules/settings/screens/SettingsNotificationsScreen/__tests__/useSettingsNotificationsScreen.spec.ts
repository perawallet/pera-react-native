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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import { AnalyticsMetadataKey, SettingsEvent } from '@analytics'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useSettingsNotificationsScreen } from '../useSettingsNotificationsScreen'
import { useSystemNotificationPermission } from '../../../hooks/useSystemNotificationPermission'

const mocks = vi.hoisted(() => ({
    toggleAccountNotification: vi.fn(),
    isTogglePending: vi.fn(() => false),
    showToast: vi.fn(),
    trackEvent: vi.fn(),
    notificationsChainOf: vi.fn(),
}))

type ChainsOf = { chains: Record<string, { address: string }> }
const defaultNotificationsChainOf = (account: ChainsOf) =>
    account.chains.algorand ? 'algorand' : undefined

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mocks.trackEvent,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    chainAccountOf: (account: ChainsOf, chainId: string) =>
        account.chains[chainId],
    useAllAccounts: vi.fn(() => []),
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useNotificationsChainResolver: () => mocks.notificationsChainOf,
    useNotificationPreferences: vi.fn(() => ({
        setAccountEnabled: vi.fn(),
        isAccountEnabled: vi.fn(() => true),
        disabledAccounts: [],
    })),
}))

vi.mock('../../../hooks/useSystemNotificationPermission', () => ({
    useSystemNotificationPermission: vi.fn(() => ({
        isEnabled: true,
        isLoading: false,
        openSettings: vi.fn(),
    })),
}))

// The real useAccountNotificationToggle is exercised by its own spec; here we
// only assert this screen delegates to it with the right arguments.
vi.mock('@hooks/useAccountNotificationToggle', () => ({
    useAccountNotificationToggle: () => ({
        toggleAccountNotification: mocks.toggleAccountNotification,
        isTogglePending: mocks.isTogglePending,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(() => ({ showToast: mocks.showToast })),
}))

const isPushSupported = vi.fn(() => true)

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        pushNotification: { isSupported: isPushSupported },
        chains: { has: () => false },
    }),
}))

describe('useSettingsNotificationsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        isPushSupported.mockReturnValue(true)
        mocks.notificationsChainOf.mockImplementation(
            defaultNotificationsChainOf,
        )
    })

    afterEach(() => onlineManager.setOnline(true))

    it('returns correct initial state', () => {
        const { result } = renderHook(() => useSettingsNotificationsScreen())

        expect(result.current.isSystemNotificationEnabled).toBe(true)
        expect(result.current.isSystemNotificationLoading).toBe(false)
        expect(result.current.accounts).toEqual([])
    })

    it('reflects the platform pushNotification.isSupported() flag', () => {
        isPushSupported.mockReturnValue(false)

        const { result } = renderHook(() => useSettingsNotificationsScreen())

        expect(result.current.isPushSupported).toBe(false)
    })

    it('passes the push-service availability through', () => {
        vi.mocked(useSystemNotificationPermission).mockReturnValueOnce({
            isEnabled: false,
            isLoading: false,
            isPushServiceUnavailable: true,
            openSettings: vi.fn(),
        } as any)

        const { result } = renderHook(() => useSettingsNotificationsScreen())

        expect(result.current.isPushServiceUnavailable).toBe(true)
    })

    it('calls openSettings when handleSystemNotificationToggle is called', () => {
        const openSettings = vi.fn()
        vi.mocked(useSystemNotificationPermission).mockReturnValueOnce({
            isEnabled: true,
            isLoading: false,
            openSettings,
        } as any)

        const { result } = renderHook(() => useSettingsNotificationsScreen())

        act(() => {
            result.current.handleSystemNotificationToggle()
        })

        expect(openSettings).toHaveBeenCalled()
    })

    it('delegates the toggle to useAccountNotificationToggle', async () => {
        mocks.toggleAccountNotification.mockResolvedValue(true)
        const mockAccount = {
            id: '1',
            chains: { algorand: { address: 'ADDR1' } },
        }

        const { result } = renderHook(() => useSettingsNotificationsScreen())

        await act(async () => {
            result.current.handleAccountNotificationToggle(
                mockAccount as any,
                true,
            )
        })

        expect(mocks.toggleAccountNotification).toHaveBeenCalledWith(
            'ADDR1',
            true,
        )
    })

    it('tracks the filter change on the Algorand chain', async () => {
        mocks.toggleAccountNotification.mockResolvedValue(true)
        const mockAccount = {
            id: '1',
            chains: { algorand: { address: 'ADDR1' } },
        }

        const { result } = renderHook(() => useSettingsNotificationsScreen())

        await act(async () => {
            result.current.handleAccountNotificationToggle(
                mockAccount as any,
                false,
            )
        })

        expect(mocks.trackEvent).toHaveBeenCalledWith(
            SettingsEvent.ChangeNotificationFilter,
            {
                [AnalyticsMetadataKey.AccountAddress]: 'ADDR1',
                [AnalyticsMetadataKey.AllowNotifications]: false,
                [AnalyticsMetadataKey.ChainId]: 'algorand',
            },
        )
    })

    // Paused-silent regime is impossible post-; the fire-and-fail
    // regime must reach the shared hook, which owns rollback + offline copy.
    it('still delegates while offline rather than swallowing the toggle', async () => {
        onlineManager.setOnline(false)
        mocks.toggleAccountNotification.mockResolvedValue(false)
        const mockAccount = {
            id: '1',
            chains: { algorand: { address: 'ADDR1' } },
        }

        const { result } = renderHook(() => useSettingsNotificationsScreen())

        await act(async () => {
            result.current.handleAccountNotificationToggle(
                mockAccount as any,
                false,
            )
        })

        expect(mocks.toggleAccountNotification).toHaveBeenCalledTimes(1)
        expect(mocks.toggleAccountNotification).toHaveBeenCalledWith(
            'ADDR1',
            false,
        )
        // The screen must not add its own generic toast on top of the shared
        // hook's cause-appropriate one.
        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    describe('an Ethereum account', () => {
        const algorandAccount = {
            id: 'algo',
            chains: { algorand: { address: 'ADDR1' } },
        }
        const ethereumAccount = {
            id: 'eth',
            chains: { ethereum: { address: '0xabc' } },
        }

        it('lists only the accounts registered for push', () => {
            vi.mocked(useAllAccounts).mockReturnValue([
                algorandAccount,
                ethereumAccount,
            ] as any)

            const { result } = renderHook(() =>
                useSettingsNotificationsScreen(),
            )

            expect(result.current.accounts).toEqual([algorandAccount])
        })

        it('lists nothing when no account is registered for push', () => {
            vi.mocked(useAllAccounts).mockReturnValue([ethereumAccount] as any)

            const { result } = renderHook(() =>
                useSettingsNotificationsScreen(),
            )

            expect(result.current.accounts).toEqual([])
        })

        it('toggles through its own address and tracks its chain once registered for push', async () => {
            mocks.notificationsChainOf.mockReturnValue('ethereum')
            mocks.toggleAccountNotification.mockResolvedValue(true)

            const { result } = renderHook(() =>
                useSettingsNotificationsScreen(),
            )
            await act(async () => {
                result.current.handleAccountNotificationToggle(
                    ethereumAccount as any,
                    true,
                )
            })

            expect(mocks.toggleAccountNotification).toHaveBeenCalledWith(
                '0xabc',
                true,
            )
            expect(mocks.trackEvent).toHaveBeenCalledWith(
                SettingsEvent.ChangeNotificationFilter,
                expect.objectContaining({
                    [AnalyticsMetadataKey.ChainId]: 'ethereum',
                }),
            )
        })

        it('does nothing when it is not registered for push', async () => {
            mocks.notificationsChainOf.mockReturnValue(undefined)

            const { result } = renderHook(() =>
                useSettingsNotificationsScreen(),
            )
            await act(async () => {
                result.current.handleAccountNotificationToggle(
                    ethereumAccount as any,
                    true,
                )
            })

            expect(mocks.toggleAccountNotification).not.toHaveBeenCalled()
            expect(mocks.trackEvent).not.toHaveBeenCalled()
        })
    })
})
