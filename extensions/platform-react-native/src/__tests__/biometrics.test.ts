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

const bindingMocks = vi.hoisted(() => ({
    module: null as {
        createBinding: ReturnType<typeof vi.fn>
        checkBinding: ReturnType<typeof vi.fn>
        clearBinding: ReturnType<typeof vi.fn>
        getAvailability: ReturnType<typeof vi.fn>
    } | null,
}))

vi.mock('expo', () => ({
    requireOptionalNativeModule: () => bindingMocks.module,
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
        test('returns a success result when the native call succeeds', async () => {
            authenticateAsyncMock.mockResolvedValue({ success: true })
            expect(
                await service.authenticate({
                    title: 't',
                    description: 'd',
                    cancelLabel: 'Cancel',
                }),
            ).toEqual({ success: true })
        })

        test.each([
            ['user_cancel', 'user-cancel'],
            ['user_fallback', 'user-cancel'],
            ['system_cancel', 'system-cancel'],
            ['app_cancel', 'system-cancel'],
            ['lockout', 'lockout'],
            ['not_available', 'unavailable'],
            ['not_enrolled', 'unavailable'],
            ['passcode_not_set', 'unavailable'],
            ['authentication_failed', 'failed'],
            ['timeout', 'unknown'],
            ['no_space', 'unknown'],
            ['unable_to_process', 'unknown'],
            ['invalid_context', 'unknown'],
            ['unknown', 'unknown'],
        ])('maps native error %j to reason %j', async (native, reason) => {
            authenticateAsyncMock.mockResolvedValue({
                success: false,
                error: native,
            })
            expect(await service.authenticate()).toEqual({
                success: false,
                reason,
            })
        })

        // iOS's default error branch returns prefixed strings rather than a
        // member of the documented union, and some strings (e.g.
        // missing_usage_description) aren't in the TS type at all.
        test.each([
            'unknown: -1004, Caller moved to background.',
            'missing_usage_description',
        ])('maps unrecognized native error %j to "unknown"', async native => {
            authenticateAsyncMock.mockResolvedValue({
                success: false,
                error: native,
            })
            expect(await service.authenticate()).toEqual({
                success: false,
                reason: 'unknown',
            })
        })

        test('returns an unknown failure when the native call throws', async () => {
            authenticateAsyncMock.mockRejectedValue(new Error('cancelled'))
            expect(await service.authenticate()).toEqual({
                success: false,
                reason: 'unknown',
            })
        })

        test('disables device PIN/password fallback (biometric-only)', async () => {
            authenticateAsyncMock.mockResolvedValue({ success: true })
            await service.authenticate({ title: 'Unlock' })
            expect(authenticateAsyncMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    promptMessage: 'Unlock',
                    disableDeviceFallback: true,
                }),
            )
        })

        // Wallet unlock and biometric enrolment must require a hardware-backed
        // class-3 authenticator; a spoofable class-2 ("weak") modality must not
        // be accepted. See the service comment for the full rationale.
        test('requires a strong (class-3) authenticator', async () => {
            authenticateAsyncMock.mockResolvedValue({ success: true })
            await service.authenticate({ title: 'Unlock' })
            expect(authenticateAsyncMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    biometricsSecurityLevel: 'strong',
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

    describe('enrollment binding', () => {
        const nativeModule = {
            createBinding: vi.fn(),
            checkBinding: vi.fn(),
            clearBinding: vi.fn(),
            getAvailability: vi.fn(),
        }

        beforeEach(() => {
            nativeModule.createBinding.mockReset()
            nativeModule.checkBinding.mockReset()
            nativeModule.clearBinding.mockReset()
            nativeModule.getAvailability.mockReset()
            bindingMocks.module = nativeModule
        })

        test.each(['valid', 'changed', 'absent', 'unavailable'] as const)(
            'passes through the native status %j',
            async status => {
                nativeModule.checkBinding.mockResolvedValue(status)
                expect(await service.checkEnrollmentBinding()).toBe(status)
            },
        )

        // 'changed' destroys the user's opt-in, so anything the JS side does not
        // recognize has to land on the status that changes nothing.
        test.each(['CHANGED', 'invalidated', ''])(
            'maps unrecognized native status %j to "unavailable"',
            async status => {
                nativeModule.checkBinding.mockResolvedValue(status)
                expect(await service.checkEnrollmentBinding()).toBe(
                    'unavailable',
                )
            },
        )

        test('reports "unavailable" when the native call throws', async () => {
            nativeModule.checkBinding.mockRejectedValue(new Error('keystore'))
            expect(await service.checkEnrollmentBinding()).toBe('unavailable')
        })

        // A build without the module must not read as a revoked enrollment.
        test('reports "unavailable" when the native module is absent', async () => {
            bindingMocks.module = null
            expect(await service.checkEnrollmentBinding()).toBe('unavailable')
        })

        test('swallows a failed createBinding rather than rejecting', async () => {
            nativeModule.createBinding.mockResolvedValue(false)
            await expect(
                service.createEnrollmentBinding(),
            ).resolves.toBeUndefined()
        })

        test('swallows a throwing clearBinding rather than rejecting', async () => {
            nativeModule.clearBinding.mockRejectedValue(new Error('keystore'))
            await expect(
                service.clearEnrollmentBinding(),
            ).resolves.toBeUndefined()
        })
    })

    describe('getAvailability', () => {
        const nativeModule = {
            createBinding: vi.fn(),
            checkBinding: vi.fn(),
            clearBinding: vi.fn(),
            getAvailability: vi.fn(),
        }

        beforeEach(() => {
            nativeModule.getAvailability.mockReset()
            bindingMocks.module = nativeModule
        })

        test.each([
            'available',
            'none-enrolled',
            'denied',
            'unavailable',
            'unknown',
        ] as const)('passes through the native status %j', async status => {
            nativeModule.getAvailability.mockResolvedValue(status)
            expect(await service.getAvailability()).toBe(status)
        })

        // 'none-enrolled' and 'denied' put a screen in front of the user, so an
        // unrecognized value must land on the one that shows nothing.
        test.each(['NONE_ENROLLED', 'not-enrolled', ''])(
            'maps unrecognized native status %j to "unknown"',
            async status => {
                nativeModule.getAvailability.mockResolvedValue(status)
                expect(await service.getAvailability()).toBe('unknown')
            },
        )

        test('reports "unknown" when the native call throws', async () => {
            nativeModule.getAvailability.mockRejectedValue(new Error('nope'))
            expect(await service.getAvailability()).toBe('unknown')
        })

        test('reports "unknown" when the native module is absent', async () => {
            bindingMocks.module = null
            expect(await service.getAvailability()).toBe('unknown')
        })
    })
})
