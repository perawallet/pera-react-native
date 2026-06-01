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

import { describe, test, expect, vi, beforeEach } from 'vitest'

const hasHardwareAsyncMock = vi.hoisted(() => vi.fn())
const isEnrolledAsyncMock = vi.hoisted(() => vi.fn())
const supportedAuthenticationTypesAsyncMock = vi.hoisted(() => vi.fn())
const authenticateAsyncMock = vi.hoisted(() => vi.fn())
const getEnrolledLevelAsyncMock = vi.hoisted(() => vi.fn())

// AuthenticationType / SecurityLevel numeric values match
// expo-local-authentication's enums.
vi.mock('expo-local-authentication', () => ({
    AuthenticationType: {
        FINGERPRINT: 1,
        FACIAL_RECOGNITION: 2,
        IRIS: 3,
    },
    SecurityLevel: {
        NONE: 0,
        SECRET: 1,
        BIOMETRIC_WEAK: 2,
        BIOMETRIC_STRONG: 3,
    },
    hasHardwareAsync: hasHardwareAsyncMock,
    isEnrolledAsync: isEnrolledAsyncMock,
    supportedAuthenticationTypesAsync: supportedAuthenticationTypesAsyncMock,
    authenticateAsync: authenticateAsyncMock,
    getEnrolledLevelAsync: getEnrolledLevelAsyncMock,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: {
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

import { RNBiometricsService } from '../services/biometrics'

describe('RNBiometricsService', () => {
    const service = new RNBiometricsService()

    const setEnrolled = () => {
        hasHardwareAsyncMock.mockResolvedValue(true)
        isEnrolledAsyncMock.mockResolvedValue(true)
    }

    beforeEach(() => {
        hasHardwareAsyncMock.mockReset()
        isEnrolledAsyncMock.mockReset()
        supportedAuthenticationTypesAsyncMock.mockReset()
        authenticateAsyncMock.mockReset()
        getEnrolledLevelAsyncMock.mockReset()
    })

    describe('getSecurityLevel', () => {
        test('maps BIOMETRIC_STRONG to "strong"', async () => {
            getEnrolledLevelAsyncMock.mockResolvedValue(3)
            expect(await service.getSecurityLevel()).toBe('strong')
        })

        test('maps BIOMETRIC_WEAK to "weak"', async () => {
            getEnrolledLevelAsyncMock.mockResolvedValue(2)
            expect(await service.getSecurityLevel()).toBe('weak')
        })

        test('maps SECRET (PIN/pattern) to "secret"', async () => {
            getEnrolledLevelAsyncMock.mockResolvedValue(1)
            expect(await service.getSecurityLevel()).toBe('secret')
        })

        test('maps NONE to "none"', async () => {
            getEnrolledLevelAsyncMock.mockResolvedValue(0)
            expect(await service.getSecurityLevel()).toBe('none')
        })

        test('returns "none" when the platform call throws', async () => {
            getEnrolledLevelAsyncMock.mockRejectedValue(
                new Error('unsupported'),
            )
            expect(await service.getSecurityLevel()).toBe('none')
        })
    })

    describe('getSupportedBiometricType', () => {
        test('returns null when hardware is not available', async () => {
            hasHardwareAsyncMock.mockResolvedValue(false)
            expect(await service.getSupportedBiometricType()).toBeNull()
        })

        test('returns null when no biometrics are enrolled', async () => {
            hasHardwareAsyncMock.mockResolvedValue(true)
            isEnrolledAsyncMock.mockResolvedValue(false)
            expect(await service.getSupportedBiometricType()).toBeNull()
        })

        test('prefers face over fingerprint when both are supported', async () => {
            setEnrolled()
            // 1 = FINGERPRINT, 2 = FACIAL_RECOGNITION
            supportedAuthenticationTypesAsyncMock.mockResolvedValue([1, 2])
            expect(await service.getSupportedBiometricType()).toBe('face')
        })

        test('returns "fingerprint" when only fingerprint is supported', async () => {
            setEnrolled()
            supportedAuthenticationTypesAsyncMock.mockResolvedValue([1])
            expect(await service.getSupportedBiometricType()).toBe(
                'fingerprint',
            )
        })

        test('returns "biometrics" when only iris is supported', async () => {
            setEnrolled()
            supportedAuthenticationTypesAsyncMock.mockResolvedValue([3])
            expect(await service.getSupportedBiometricType()).toBe('biometrics')
        })

        test('returns null when supported list is empty', async () => {
            setEnrolled()
            supportedAuthenticationTypesAsyncMock.mockResolvedValue([])
            expect(await service.getSupportedBiometricType()).toBeNull()
        })
    })

    describe('checkBiometricsAvailable', () => {
        test('returns true when a supported type exists', async () => {
            setEnrolled()
            supportedAuthenticationTypesAsyncMock.mockResolvedValue([2])
            expect(await service.checkBiometricsAvailable()).toBe(true)
        })

        test('returns false when no type is supported', async () => {
            hasHardwareAsyncMock.mockResolvedValue(false)
            expect(await service.checkBiometricsAvailable()).toBe(false)
        })
    })

    describe('authenticate', () => {
        test('returns the native success flag', async () => {
            authenticateAsyncMock.mockResolvedValue({ success: true })
            expect(
                await service.authenticate({
                    title: 't',
                    description: 'd',
                    cancelLabel: 'Cancel',
                }),
            ).toBe(true)
        })

        test('returns false when the native call resolves with success: false', async () => {
            authenticateAsyncMock.mockResolvedValue({
                success: false,
                error: 'user_cancel',
            })
            expect(await service.authenticate()).toBe(false)
        })

        test('returns false when the native call throws', async () => {
            authenticateAsyncMock.mockRejectedValue(new Error('cancelled'))
            expect(await service.authenticate()).toBe(false)
        })

        test('disables device PIN/password fallback (biometric-only)', async () => {
            authenticateAsyncMock.mockResolvedValue({ success: true })
            await service.authenticate({ title: 'Unlock' })
            expect(authenticateAsyncMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    promptMessage: 'Unlock',
                    disableDeviceFallback: true,
                    // Intentionally 'weak' — see service comment for the
                    // Samsung S21 / Galaxy firmware compatibility rationale.
                    biometricsSecurityLevel: 'weak',
                }),
            )
        })

        // Regression: AndroidX BiometricPrompt's PromptInfo.Builder#build()
        // throws IllegalArgumentException unless a non-empty negative button
        // text is supplied whenever DEVICE_CREDENTIAL isn't in the allowed
        // authenticators. Forwarding cancelLabel keeps the prompt buildable.
        test('forwards cancelLabel to the native call', async () => {
            authenticateAsyncMock.mockResolvedValue({ success: true })
            await service.authenticate({
                title: 'Unlock',
                cancelLabel: 'Dismiss',
            })
            expect(authenticateAsyncMock).toHaveBeenCalledWith(
                expect.objectContaining({ cancelLabel: 'Dismiss' }),
            )
        })

        test('falls back to a non-empty cancelLabel when caller omits it', async () => {
            authenticateAsyncMock.mockResolvedValue({ success: true })
            await service.authenticate({ title: 'Unlock' })
            const call = authenticateAsyncMock.mock.calls[0][0]
            expect(call.cancelLabel).toEqual(expect.any(String))
            expect(call.cancelLabel.length).toBeGreaterThan(0)
        })
    })
})
