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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSettingsNotificationsScreen } from '../useSettingsNotificationsScreen'
import {
    useNotificationPreferences,
    useAccountNotificationEnabledMutation,
} from '@perawallet/wallet-core-notifications'
import { useSystemNotificationPermission } from '../../../hooks/useSystemNotificationPermission'
import { useToast } from '@hooks/useToast'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => []),
}))

vi.mock('@perawallet/wallet-core-notifications', () => ({
    useNotificationPreferences: vi.fn(() => ({
        setAccountEnabled: vi.fn(),
        isAccountEnabled: vi.fn(() => true),
    })),
    useAccountNotificationEnabledMutation: vi.fn(() => ({
        mutateAsync: vi.fn().mockResolvedValue({}),
    })),
}))

vi.mock('../../../hooks/useSystemNotificationPermission', () => ({
    useSystemNotificationPermission: vi.fn(() => ({
        isEnabled: true,
        isLoading: false,
        openSettings: vi.fn(),
    })),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(() => ({
        showToast: vi.fn(),
    })),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(() => ({
        t: vi.fn(key => key),
    })),
}))

describe('useSettingsNotificationsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns correct initial state', () => {
        const { result } = renderHook(() => useSettingsNotificationsScreen())

        expect(result.current.isSystemNotificationEnabled).toBe(true)
        expect(result.current.isSystemNotificationLoading).toBe(false)
        expect(result.current.accounts).toEqual([])
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

    it('calls setAccountEnabled and mutateAsync when handleAccountNotificationToggle is called', async () => {
        const setAccountEnabled = vi.fn()
        const mutateAsync = vi.fn().mockResolvedValue({})
        const mockAccount = { id: '1', address: 'ADDR1' }

        vi.mocked(useNotificationPreferences).mockReturnValueOnce({
            setAccountEnabled,
            isAccountEnabled: vi.fn(),
        } as any)
        vi.mocked(useAccountNotificationEnabledMutation).mockReturnValueOnce({
            mutateAsync,
        } as any)

        const { result } = renderHook(() => useSettingsNotificationsScreen())

        await act(async () => {
            result.current.handleAccountNotificationToggle(
                mockAccount as any,
                true,
            )
        })

        expect(setAccountEnabled).toHaveBeenCalledWith('ADDR1', true)
        expect(mutateAsync).toHaveBeenCalledWith({
            accountID: 'ADDR1',
            status: true,
        })
    })

    it('shows error toast and reverts state if mutateAsync fails', async () => {
        const setAccountEnabled = vi.fn()
        const mutateAsync = vi.fn().mockRejectedValue(new Error('Failed'))
        const showToast = vi.fn()
        const mockAccount = { id: '1', address: 'ADDR1' }

        vi.mocked(useNotificationPreferences).mockReturnValueOnce({
            setAccountEnabled,
            isAccountEnabled: vi.fn(),
        } as any)
        vi.mocked(useAccountNotificationEnabledMutation).mockReturnValueOnce({
            mutateAsync,
        } as any)
        vi.mocked(useToast).mockReturnValueOnce({
            showToast,
        } as any)

        const { result } = renderHook(() => useSettingsNotificationsScreen())

        await act(async () => {
            result.current.handleAccountNotificationToggle(
                mockAccount as any,
                true,
            )
        })

        expect(setAccountEnabled).toHaveBeenCalledWith('ADDR1', true)
        expect(setAccountEnabled).toHaveBeenCalledWith('ADDR1', false)
        expect(showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
            }),
        )
    })
})
