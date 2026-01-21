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
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { AutoLockGuard } from '../AutoLockGuard'
import { Text } from 'react-native'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'
import { useDeleteAllData } from '@modules/settings/hooks/useDeleteAllData'

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
    useBiometrics: vi.fn(),
    PIN_LENGTH: 4,
}))

vi.mock('@modules/settings/hooks/useDeleteAllData', () => ({
    useDeleteAllData: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        formatTime: (seconds: number) => {
            const mins = Math.floor(seconds / 60)
            const secs = seconds % 60
            return `${mins}:${secs.toString().padStart(2, '0')}`
        },
    }
})

vi.mock('react-native', async () => {
    const actual = await vi.importActual('react-native')
    return {
        ...actual,
        AppState: {
            currentState: 'active',
            addEventListener: vi.fn(() => ({
                remove: vi.fn(),
            })),
        },
    }
})

describe('AutoLockGuard', () => {
    const mockCheckAutoLock = vi.fn()
    const mockSetAutoLockStartedAt = vi.fn()
    const mockCheckPinEnabled = vi.fn()
    const mockDeleteAllData = vi.fn()
    const mockVerifyPin = vi.fn()
    const mockHandleFailedAttempt = vi.fn()
    const mockResetFailedAttempts = vi.fn()
    const mockSetLockoutEndTime = vi.fn()
    const mockCheckBiometricsEnabled = vi.fn()
    const mockAuthenticateWithBiometrics = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockCheckPinEnabled.mockResolvedValue(false)
        mockCheckAutoLock.mockResolvedValue(false)
        mockCheckBiometricsEnabled.mockResolvedValue(false)
        ;(usePinCode as Mock).mockReturnValue({
            checkAutoLock: mockCheckAutoLock,
            setAutoLockStartedAt: mockSetAutoLockStartedAt,
            checkPinEnabled: mockCheckPinEnabled,
            verifyPin: mockVerifyPin,
            handleFailedAttempt: mockHandleFailedAttempt,
            resetFailedAttempts: mockResetFailedAttempts,
            isLockedOut: false,
            lockoutEndTime: null,
            setLockoutEndTime: mockSetLockoutEndTime,
        })
        ;(useBiometrics as Mock).mockReturnValue({
            checkBiometricsEnabled: mockCheckBiometricsEnabled,
            authenticateWithBiometrics: mockAuthenticateWithBiometrics,
        })
        ;(useDeleteAllData as Mock).mockReturnValue(mockDeleteAllData)
    })

    it('renders children', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)

        const { findByText } = render(
            <AutoLockGuard>
                <Text>Child Content</Text>
            </AutoLockGuard>,
        )

        expect(await findByText('Child Content')).toBeTruthy()
    })

    it('shows loading view while checking', () => {
        const { queryByText } = render(
            <AutoLockGuard>
                <Text>Child Content</Text>
            </AutoLockGuard>,
        )

        expect(queryByText('Child Content')).toBeTruthy()
    })

    it('shows PIN entry when locked', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)

        const { findByText } = render(
            <AutoLockGuard>
                <Text>Child Content</Text>
            </AutoLockGuard>,
        )

        expect(await findByText('security.pin.unlock_title')).toBeTruthy()
    })

    it('shows lockout view when locked out', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        ;(usePinCode as Mock).mockReturnValue({
            checkAutoLock: mockCheckAutoLock,
            setAutoLockStartedAt: mockSetAutoLockStartedAt,
            checkPinEnabled: mockCheckPinEnabled,
            verifyPin: mockVerifyPin,
            handleFailedAttempt: mockHandleFailedAttempt,
            resetFailedAttempts: mockResetFailedAttempts,
            isLockedOut: true,
            lockoutEndTime: Date.now() + 60000,
            setLockoutEndTime: mockSetLockoutEndTime,
        })

        const { findByText } = render(
            <AutoLockGuard>
                <Text>Child Content</Text>
            </AutoLockGuard>,
        )

        expect(await findByText('security.lockout.title')).toBeTruthy()
    })

    it('renders numpad when PIN entry is shown', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)

        const { findByText } = render(
            <AutoLockGuard>
                <Text>Child Content</Text>
            </AutoLockGuard>,
        )

        expect(await findByText('1')).toBeTruthy()
        expect(await findByText('2')).toBeTruthy()
        expect(await findByText('3')).toBeTruthy()
    })
})
