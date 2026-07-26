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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { UserPreferences } from '@constants/user-preferences'
import { useSettingsPasskeysScreen } from '../useSettingsPasskeysScreen.web'

const mocks = vi.hoisted(() => ({
    passkeys: [] as { id: string }[],
    isPasskeysLoading: false,
    isPasskeysError: false,
    refetch: vi.fn(),
    removePasskey: vi.fn(),
    preferences: {} as Record<string, string | boolean | number>,
    setPreference: vi.fn(),
    getPreference: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-passkeys', () => ({
    usePasskeysQuery: () => ({
        passkeys: mocks.passkeys,
        isLoading: mocks.isPasskeysLoading,
        isError: mocks.isPasskeysError,
        refetch: mocks.refetch,
    }),
    useRemovePasskeyMutation: () => ({ removePasskey: mocks.removePasskey }),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    useBiometricSecurityLevel: () => ({
        isLoading: false,
        hasStrongBiometricOrCredential: true,
        refresh: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useHasHDWallet: () => true,
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: () => ({
        getPreference: mocks.getPreference,
        setPreference: mocks.setPreference,
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: vi.fn() }),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: vi.fn() }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    PasskeysEvent: { Deleted: 'passkeys_deleted' },
}))

describe('useSettingsPasskeysScreen (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.passkeys = []
        mocks.isPasskeysLoading = false
        mocks.isPasskeysError = false
        mocks.preferences = {}
        mocks.getPreference.mockImplementation(
            (key: string) => mocks.preferences[key] ?? null,
        )
        mocks.setPreference.mockImplementation(
            (key: string, value: boolean) => {
                mocks.preferences[key] = value
            },
        )
    })

    it('defaults to OFF and reports "disabled" when the preference is unset', () => {
        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.isInterceptionEnabled).toBe(false)
        expect(result.current.state).toBe('disabled')
    })

    it('reflects webauthnInterceptionEnabled=true from the settings store', () => {
        mocks.preferences[UserPreferences.webauthnInterceptionEnabled] = true

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.isInterceptionEnabled).toBe(true)
        expect(result.current.state).toBe('empty')
    })

    it('persists the toggle via setPreference under the shared preference key', () => {
        const { result } = renderHook(() => useSettingsPasskeysScreen())

        result.current.onToggleInterception(true)

        expect(mocks.setPreference).toHaveBeenCalledWith(
            UserPreferences.webauthnInterceptionEnabled,
            true,
        )
    })

    it('reports "populated" for existing passkeys even while the toggle is off', () => {
        mocks.passkeys = [{ id: 'cred-1' }]
        mocks.preferences[UserPreferences.webauthnInterceptionEnabled] = false

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.isInterceptionEnabled).toBe(false)
        expect(result.current.state).toBe('populated')
    })
})
