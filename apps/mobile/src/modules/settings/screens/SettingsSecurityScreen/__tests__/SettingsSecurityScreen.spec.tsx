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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { SettingsSecurityScreen } from '../SettingsSecurityScreen'

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(() => ({
        isPinEnabled: false,
        failedAttempts: 0,
        lockoutEndTime: null,
        isLockedOut: false,
        remainingLockoutSeconds: 0,
        savePin: vi.fn(),
        verifyPin: vi.fn(),
        deletePin: vi.fn(),
        changePin: vi.fn(),
        handleFailedAttempt: vi.fn(),
        resetFailedAttempts: vi.fn(),
        getLockoutDuration: vi.fn(),
    })),
    useBiometrics: vi.fn(() => ({
        isBiometricEnabled: false,
        enableBiometrics: vi.fn(),
        disableBiometrics: vi.fn(),
        authenticateWithBiometrics: vi.fn(),
    })),
}))

describe('SettingsSecurityScreen', () => {
    it('renders correctly', () => {
        const { getByText } = render(<SettingsSecurityScreen />)
        expect(
            getByText('settings.security.security_settings_section'),
        ).toBeTruthy()
        expect(getByText('settings.security.enable_pin_security')).toBeTruthy()
        expect(getByText('settings.security.antispam_section')).toBeTruthy()
        expect(getByText('settings.security.enable_rekey_support')).toBeTruthy()
    })
})
