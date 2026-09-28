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
import { act, renderHook } from '@testing-library/react'
import type { Passkey } from '@perawallet/wallet-core-passkeys'
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
    requestSheet: vi.fn(),
    isCloudBackupEnabled: true,
    isPasskeyBackedUp: vi.fn<(s: unknown, id: string) => boolean>(() => false),
    deletePasskeyFromBackup: vi.fn(async () => 'settled'),
    keepPasskeyInBackup: vi.fn(async () => true),
    showToast: vi.fn(),
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
    useBottomSheet: () => ({ request: mocks.requestSheet }),
}))

vi.mock('@modules/cloud-backup', () => ({
    DeleteFromBackupSheet: () => null,
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    getBackupSyncManager: () => ({
        deletePasskeyFromBackup: mocks.deletePasskeyFromBackup,
        keepPasskeyInBackup: mocks.keepPasskeyInBackup,
    }),
    isPasskeyBackedUp: (syncState: unknown, credentialId: string) =>
        mocks.isPasskeyBackedUp(syncState, credentialId),
    useBackupSyncStateStore: (selector: (s: unknown) => unknown) =>
        selector({ syncState: null }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: vi.fn() },
}))

vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: () => mocks.isCloudBackupEnabled,
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: vi.fn() }),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    PasskeysEvent: { Deleted: 'passkeys_deleted' },
}))

const FLAGGED_PASSKEY = { id: 'cred-1', needsMigration: true } as Passkey
const UNFLAGGED_PASSKEY = { id: 'cred-2', needsMigration: false } as Passkey

describe('useSettingsPasskeysScreen (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.passkeys = []
        mocks.isPasskeysLoading = false
        mocks.isPasskeysError = false
        mocks.isCloudBackupEnabled = true
        mocks.isPasskeyBackedUp.mockReturnValue(false)
        mocks.deletePasskeyFromBackup.mockResolvedValue('settled')
        mocks.requestSheet.mockResolvedValue(true)
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

    // Web's re-registration prerequisite is the toggle above the list, not an
    // OS credential-provider trip, so the gate is cheap to satisfy — but it is
    // still a prerequisite, and a flagged credential deleted while it is off
    // is as unrecoverable here as on native.
    it('withholds removal of a flagged passkey while interception is off, and only for that one', () => {
        mocks.preferences[UserPreferences.webauthnInterceptionEnabled] = false

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.canRemove(FLAGGED_PASSKEY)).toBe(false)
        expect(result.current.canRemove(UNFLAGGED_PASSKEY)).toBe(true)
    })

    it('offers removal of a flagged passkey once interception is on', () => {
        mocks.preferences[UserPreferences.webauthnInterceptionEnabled] = true

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.canRemove(FLAGGED_PASSKEY)).toBe(true)
    })

    // The extension reaches the same Cloud Backup stack as native, so a
    // credential removed here has to land in a bucket too — without the gate it
    // stays ACTIVE server-side and invisible in every review list.
    it('asks what to do with the backup copy before removing a backed-up passkey', async () => {
        const backedUp = {
            id: 'cred-1',
            keyId: 'raw-cred-1',
            displayName: 'example.com',
            needsMigration: false,
        } as Passkey
        mocks.isPasskeyBackedUp.mockReturnValue(true)

        const { result } = renderHook(() => useSettingsPasskeysScreen())
        await act(async () => {
            result.current.onRequestDelete(backedUp)
        })

        expect(mocks.isPasskeyBackedUp).toHaveBeenCalledWith(null, 'raw-cred-1')
        expect(mocks.deletePasskeyFromBackup).toHaveBeenCalledWith('raw-cred-1')
        expect(mocks.removePasskey).toHaveBeenCalledWith(backedUp)
    })

    it('abandons the removal when the backup choice is dismissed', async () => {
        mocks.isPasskeyBackedUp.mockReturnValue(true)
        mocks.requestSheet
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useSettingsPasskeysScreen())
        await act(async () => {
            result.current.onRequestDelete({
                id: 'cred-1',
                keyId: 'raw-cred-1',
                displayName: 'example.com',
            } as Passkey)
        })

        expect(mocks.deletePasskeyFromBackup).not.toHaveBeenCalled()
        expect(mocks.removePasskey).not.toHaveBeenCalled()
    })
})
