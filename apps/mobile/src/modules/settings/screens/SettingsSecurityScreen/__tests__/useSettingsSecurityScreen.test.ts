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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSettingsSecurityScreen } from '../useSettingsSecurityScreen'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'
import { usePreferences } from '@perawallet/wallet-core-settings'

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
    useBiometrics: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: () => ({
        getBooleanValue: (_key: string, fallback: boolean) => fallback,
    }),
    RemoteConfigKeys: {
        enable_motion_lock: 'enable-motion-lock',
        enable_duress_pin: 'enable-duress-pin',
    },
}))

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@modules/security', () => ({
    PinEditContent: () => null,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

const { mockShowToast } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

describe('useSettingsSecurityScreen', () => {
    const mockCheckPinEnabled = vi.fn()
    const mockSavePin = vi.fn()
    const mockEnableBiometrics = vi.fn()
    const mockDisableBiometrics = vi.fn()
    const mockSetPreference = vi.fn()
    const mockGetPreference = vi.fn()
    const mockVerifyPin = vi.fn()
    const mockSaveDuressPin = vi.fn()
    const mockCheckDuressPinEnabled = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockCheckPinEnabled.mockResolvedValue(false)
        mockCheckDuressPinEnabled.mockResolvedValue(false)
        mockGetPreference.mockReturnValue(undefined)
        mockVerifyPin.mockResolvedValue({ kind: 'fail' })
        ;(usePinCode as Mock).mockReturnValue({
            checkPinEnabled: mockCheckPinEnabled,
            savePin: mockSavePin,
            verifyPin: mockVerifyPin,
            saveDuressPin: mockSaveDuressPin,
            checkDuressPinEnabled: mockCheckDuressPinEnabled,
        })
        ;(useBiometrics as Mock).mockReturnValue({
            isEnabled: false,
            isAvailable: false,
            enableBiometrics: mockEnableBiometrics,
            disableBiometrics: mockDisableBiometrics,
        })
        ;(usePreferences as Mock).mockReturnValue({
            setPreference: mockSetPreference,
            getPreference: mockGetPreference,
        })
        mockRequestBottomSheet.mockResolvedValue(undefined)
    })

    it('should return initial state', async () => {
        const { result } = renderHook(() => useSettingsSecurityScreen())

        await waitFor(() => {
            expect(result.current.isPinEnabled).toBe(false)
        })

        expect(result.current.isBiometricEnabled).toBe(false)
        expect(result.current.isBiometricsAvailable).toBe(false)
    })

    it('should check pin settings on mount', async () => {
        renderHook(() => useSettingsSecurityScreen())

        await waitFor(() => {
            expect(mockCheckPinEnabled).toHaveBeenCalled()
        })
    })

    it('should update isPinEnabled when checkPinEnabled returns true', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)

        const { result } = renderHook(() => useSettingsSecurityScreen())

        await waitFor(() => {
            expect(result.current.isPinEnabled).toBe(true)
        })
    })

    it('should reflect isBiometricEnabled from useBiometrics hook', () => {
        ;(useBiometrics as Mock).mockReturnValue({
            isEnabled: true,
            isAvailable: false,
            enableBiometrics: mockEnableBiometrics,
            disableBiometrics: mockDisableBiometrics,
        })

        const { result } = renderHook(() => useSettingsSecurityScreen())

        expect(result.current.isBiometricEnabled).toBe(true)
    })

    it('should reflect isBiometricsAvailable from useBiometrics hook', () => {
        ;(useBiometrics as Mock).mockReturnValue({
            isEnabled: false,
            isAvailable: true,
            enableBiometrics: mockEnableBiometrics,
            disableBiometrics: mockDisableBiometrics,
        })

        const { result } = renderHook(() => useSettingsSecurityScreen())

        expect(result.current.isBiometricsAvailable).toBe(true)
    })

    describe('handlePinToggle', () => {
        it('opens the PIN sheet when enabling PIN and persists on success', async () => {
            mockRequestBottomSheet.mockResolvedValue(true)
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            await act(async () => {
                await result.current.handlePinToggle(true)
            })

            expect(mockRequestBottomSheet).toHaveBeenCalled()
            expect(mockSavePin).not.toHaveBeenCalled()
            expect(mockSetPreference).toHaveBeenCalled()
        })

        it('clears the saved PIN when disabling PIN and the sheet resolves with success', async () => {
            mockRequestBottomSheet.mockResolvedValue(true)
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            await act(async () => {
                await result.current.handlePinToggle(false)
            })

            expect(mockSavePin).toHaveBeenCalledWith(null)
        })

        it('does nothing when the sheet is dismissed', async () => {
            mockRequestBottomSheet.mockResolvedValue(undefined)
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            await act(async () => {
                await result.current.handlePinToggle(true)
            })

            expect(mockSavePin).not.toHaveBeenCalled()
            expect(mockSetPreference).not.toHaveBeenCalled()
        })
    })

    describe('handleBiometricToggle', () => {
        it('should call enableBiometrics when enabling biometrics', async () => {
            mockEnableBiometrics.mockResolvedValue({ ok: true })

            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            let success: boolean
            await act(async () => {
                success = await result.current.handleBiometricToggle(true)
            })

            expect(mockEnableBiometrics).toHaveBeenCalled()
            expect(success!).toBe(true)
        })

        // Regression: AndroidX BiometricPrompt's PromptInfo.Builder#build()
        // throws unless a non-empty negative button text is supplied when
        // DEVICE_CREDENTIAL isn't in the allowed authenticators. The screen
        // must forward a localized cancelLabel through to enableBiometrics.
        it('forwards a localized title and cancelLabel to enableBiometrics', async () => {
            mockEnableBiometrics.mockResolvedValue({ ok: true })

            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            await act(async () => {
                await result.current.handleBiometricToggle(true)
            })

            expect(mockEnableBiometrics).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: expect.any(String),
                    cancelLabel: expect.any(String),
                }),
            )
            const arg = mockEnableBiometrics.mock.calls[0][0]
            expect(arg.title.length).toBeGreaterThan(0)
            expect(arg.cancelLabel.length).toBeGreaterThan(0)
        })

        it('should call disableBiometrics when disabling biometrics', async () => {
            mockDisableBiometrics.mockResolvedValue(undefined)

            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            let success: boolean
            await act(async () => {
                success = await result.current.handleBiometricToggle(false)
            })

            expect(mockDisableBiometrics).toHaveBeenCalled()
            expect(success!).toBe(true)
        })

        it('should return false when enableBiometrics fails', async () => {
            mockEnableBiometrics.mockResolvedValue({
                ok: false,
                reason: 'declined',
            })

            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            let success: boolean
            await act(async () => {
                success = await result.current.handleBiometricToggle(true)
            })

            expect(success!).toBe(false)
            // A generic failure shows the generic error toast.
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'settings.security.biometric_error_title',
                }),
            )
        })

        it('shows the weak-biometric guidance toast when the device lacks a strong biometric', async () => {
            mockEnableBiometrics.mockResolvedValue({
                ok: false,
                reason: 'weak-biometric',
            })

            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            let success: boolean
            await act(async () => {
                success = await result.current.handleBiometricToggle(true)
            })

            expect(success!).toBe(false)
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'settings.security.biometric_weak_title',
                    body: 'settings.security.biometric_weak_message',
                    type: 'error',
                }),
            )
        })

        it('shows the passcode-unlock guidance toast when the level is unconfirmed (iOS Face ID lockout)', async () => {
            mockEnableBiometrics.mockResolvedValue({
                ok: false,
                reason: 'unconfirmed',
            })

            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            let success: boolean
            await act(async () => {
                success = await result.current.handleBiometricToggle(true)
            })

            expect(success!).toBe(false)
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'settings.security.biometric_unconfirmed_title',
                    body: 'settings.security.biometric_unconfirmed_message',
                    type: 'error',
                }),
            )
        })
    })

    describe('handleChangePinPress', () => {
        it('opens the PIN sheet in change_old mode', async () => {
            mockRequestBottomSheet.mockResolvedValue(true)
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            await act(async () => {
                await result.current.handleChangePinPress()
            })

            expect(mockRequestBottomSheet).toHaveBeenCalled()
            expect(mockSetPreference).toHaveBeenCalled()
        })
    })

    describe('handleAssetFreezeToggle', () => {
        it('should set asset freeze support preference when toggled on', async () => {
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            act(() => {
                result.current.handleAssetFreezeToggle(true)
            })

            expect(mockSetPreference).toHaveBeenCalledWith(
                'asset-freeze-support-enabled',
                true,
            )
        })

        it('should clear asset freeze support preference when toggled off', async () => {
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            act(() => {
                result.current.handleAssetFreezeToggle(false)
            })

            expect(mockSetPreference).toHaveBeenCalledWith(
                'asset-freeze-support-enabled',
                false,
            )
        })
    })
})
