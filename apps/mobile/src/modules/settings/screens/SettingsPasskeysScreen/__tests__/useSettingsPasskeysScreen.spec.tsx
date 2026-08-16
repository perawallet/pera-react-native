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
import { AppState } from 'react-native'
import { useSettingsPasskeysScreen } from '../useSettingsPasskeysScreen'

const mocks = vi.hoisted(() => ({
    passkeys: [] as { id: string }[],
    isPasskeysLoading: false,
    isPasskeysError: false,
    refetch: vi.fn(),
    removePasskey: vi.fn(),
    isStatusLoading: false,
    isProviderActive: true,
    hasHDWallet: true,
    hasStrongBiometricOrCredential: true,
    usePasskeyMigrationBanner: vi.fn(),
}))

vi.mock('../../../components/PasskeyMigrationBanner', () => ({
    usePasskeyMigrationBanner: mocks.usePasskeyMigrationBanner,
}))

vi.mock('@perawallet/wallet-core-passkeys', () => ({
    usePasskeysQuery: () => ({
        passkeys: mocks.passkeys,
        isLoading: mocks.isPasskeysLoading,
        isError: mocks.isPasskeysError,
        refetch: mocks.refetch,
    }),
    usePasskeyAutofillStatus: () => ({
        isLoading: mocks.isStatusLoading,
        isProviderActive: mocks.isProviderActive,
        refresh: vi.fn(),
        openProviderSettings: vi.fn(),
    }),
    useRemovePasskeyMutation: () => ({ removePasskey: mocks.removePasskey }),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    useBiometricSecurityLevel: () => ({
        isLoading: false,
        hasStrongBiometricOrCredential: mocks.hasStrongBiometricOrCredential,
        refresh: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useHasHDWallet: () => mocks.hasHDWallet,
}))

vi.mock('../openCredentialProviderSettings', () => ({
    openCredentialProviderSettings: vi.fn(),
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

describe('useSettingsPasskeysScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.passkeys = []
        mocks.isPasskeysLoading = false
        mocks.isPasskeysError = false
        mocks.isStatusLoading = false
        mocks.isProviderActive = true
        mocks.hasHDWallet = true
        mocks.hasStrongBiometricOrCredential = true
        mocks.usePasskeyMigrationBanner.mockReturnValue({
            affected: [],
            isVisible: false,
            canRecreate: false,
            onRecreate: vi.fn(),
            onDismiss: vi.fn(),
        })
        vi.spyOn(AppState, 'addEventListener').mockReturnValue({
            remove: vi.fn(),
        } as unknown as ReturnType<typeof AppState.addEventListener>)
    })

    it('is not managing while the status or the list is still loading', () => {
        mocks.isPasskeysLoading = true

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.state).toBe('loading')
        expect(result.current.isManaging).toBe(false)
    })

    it('is not managing when the list errored', () => {
        mocks.isPasskeysError = true

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.state).toBe('error')
        expect(result.current.isManaging).toBe(false)
    })

    // The prerequisites are deliberately all met here: `canScan` is true in
    // this exact state, so passing it in `isManaging`'s place would still
    // compile and still pass every other assertion in this file.
    it('is not managing while the provider is off, even though a scan is still offered', () => {
        mocks.isProviderActive = false

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.state).toBe('disabled')
        expect(result.current.canScan).toBe(true)
        expect(result.current.isManaging).toBe(false)
    })

    it('is managing once the provider is on and the list is empty', () => {
        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.state).toBe('empty')
        expect(result.current.isManaging).toBe(true)
    })

    it('is managing with passkeys to show, whatever the provider reports', () => {
        mocks.passkeys = [{ id: 'cred-1' }]
        mocks.isProviderActive = false

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.state).toBe('populated')
        expect(result.current.isManaging).toBe(true)
    })

    // Both banner gates are wired here rather than in the screen body, so the
    // wiring is checkable. This state is the one that separates them: the
    // provider is off, `canScan` is true (so passing it in `isManaging`'s
    // place would still compile and still be right here), and `isManaging` is
    // false.
    it('hands the banner the managed-content gate, not the scanner gate', () => {
        mocks.isProviderActive = false

        renderHook(() => useSettingsPasskeysScreen())

        expect(mocks.usePasskeyMigrationBanner).toHaveBeenCalledWith(
            expect.objectContaining({
                isManaging: false,
                isProviderActive: false,
            }),
        )
    })

    // The other half: `populated` wins over `disabled` in `resolveState`, so
    // `isManaging` is true while a replacement passkey cannot be registered.
    // Passing `isManaging` for `isProviderActive` would pass the case above.
    it('hands the banner the raw provider state, not the managed-content gate', () => {
        mocks.passkeys = [{ id: 'cred-1' }]
        mocks.isProviderActive = false

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.isManaging).toBe(true)
        expect(mocks.usePasskeyMigrationBanner).toHaveBeenCalledWith(
            expect.objectContaining({
                isManaging: true,
                isProviderActive: false,
            }),
        )
    })

    it('exposes the banner state it composed', () => {
        mocks.usePasskeyMigrationBanner.mockReturnValue({
            affected: [],
            isVisible: true,
            canRecreate: false,
            onRecreate: vi.fn(),
            onDismiss: vi.fn(),
        })

        const { result } = renderHook(() => useSettingsPasskeysScreen())

        expect(result.current.migration.isVisible).toBe(true)
        expect(result.current.migration.canRecreate).toBe(false)
    })
})
