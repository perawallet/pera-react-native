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

import { render, fireEvent, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { SettingsSecurityScreen } from '../SettingsSecurityScreen'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
    useBiometrics: vi.fn(),
    PIN_LENGTH: 4,
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(() => ({
        setPreference: vi.fn(),
    })),
}))

describe('SettingsSecurityScreen', () => {
    const mockCheckPinEnabled = vi.fn()
    const mockCheckBiometricsEnabled = vi.fn()
    const mockCheckBiometricsAvailable = vi.fn()
    const mockSavePin = vi.fn()
    const mockEnableBiometrics = vi.fn()
    const mockDisableBiometrics = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockCheckPinEnabled.mockResolvedValue(false)
        mockCheckBiometricsEnabled.mockResolvedValue(false)
        mockCheckBiometricsAvailable.mockResolvedValue(false)
        ;(usePinCode as Mock).mockReturnValue({
            failedAttempts: 0,
            lockoutEndTime: null,
            isLockedOut: false,
            remainingLockoutSeconds: 0,
            checkPinEnabled: mockCheckPinEnabled,
            checkAutoLock: vi.fn().mockResolvedValue(false),
            savePin: mockSavePin,
            verifyPin: vi.fn(),
            handleFailedAttempt: vi.fn(),
            resetFailedAttempts: vi.fn(),
            getLockoutDuration: vi.fn(),
            setLockoutEndTime: vi.fn(),
            setAutoLockStartedAt: vi.fn(),
        })
        ;(useBiometrics as Mock).mockReturnValue({
            checkBiometricsEnabled: mockCheckBiometricsEnabled,
            checkBiometricsAvailable: mockCheckBiometricsAvailable,
            setBiometricsCode: vi.fn(),
            enableBiometrics: mockEnableBiometrics,
            disableBiometrics: mockDisableBiometrics,
            authenticateWithBiometrics: vi.fn(),
        })
    })

    it('renders correctly', () => {
        const { getByText } = render(<SettingsSecurityScreen />)
        expect(
            getByText('settings.security.security_settings_section'),
        ).toBeTruthy()
        expect(getByText('settings.security.enable_pin_security')).toBeTruthy()
        expect(getByText('settings.security.antispam_section')).toBeTruthy()
        expect(getByText('settings.security.enable_rekey_support')).toBeTruthy()
    })

    it('renders PIN toggle switch', () => {
        const { getByText } = render(<SettingsSecurityScreen />)
        expect(getByText('settings.security.enable_pin_security')).toBeTruthy()
    })

    it('renders rekey support description', () => {
        const { getByText } = render(<SettingsSecurityScreen />)
        expect(
            getByText('settings.security.enable_rekey_support_description'),
        ).toBeTruthy()
    })

    it('does not show change PIN option when PIN is disabled', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)

        const { queryByText } = render(<SettingsSecurityScreen />)

        await waitFor(() => {
            expect(queryByText('settings.security.change_pin')).toBeNull()
        })
    })

    it('shows change PIN option when PIN is enabled', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)

        const { findByText } = render(<SettingsSecurityScreen />)

        expect(await findByText('settings.security.change_pin')).toBeTruthy()
    })

    it('does not show biometrics option when PIN is disabled', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        mockCheckBiometricsAvailable.mockResolvedValue(true)

        const { queryByText } = render(<SettingsSecurityScreen />)

        await waitFor(() => {
            expect(
                queryByText('settings.security.enable_biometrics'),
            ).toBeNull()
        })
    })

    it('does not show biometrics option when biometrics unavailable', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        mockCheckBiometricsAvailable.mockResolvedValue(false)

        const { queryByText, findByText } = render(<SettingsSecurityScreen />)

        await findByText('settings.security.change_pin')

        expect(queryByText('settings.security.enable_biometrics')).toBeNull()
    })

    it('shows biometrics option when PIN is enabled and biometrics available', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        mockCheckBiometricsAvailable.mockResolvedValue(true)

        const { findByText } = render(<SettingsSecurityScreen />)

        expect(
            await findByText('settings.security.enable_biometrics'),
        ).toBeTruthy()
    })
})
