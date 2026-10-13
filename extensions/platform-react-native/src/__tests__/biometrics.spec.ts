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

import { describe, test, it, expect, vi, beforeEach } from 'vitest'

const hasHardwareAsyncMock = vi.hoisted(() => vi.fn())
const isEnrolledAsyncMock = vi.hoisted(() => vi.fn())
const supportedAuthenticationTypesAsyncMock = vi.hoisted(() => vi.fn())
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
        checkBinding: ReturnType<typeof vi.fn>
        clearBinding: ReturnType<typeof vi.fn>
        getAvailability: ReturnType<typeof vi.fn>
        armBinding: ReturnType<typeof vi.fn>
        beginUnwrap: ReturnType<typeof vi.fn>
        finishUnwrap: ReturnType<typeof vi.fn>
        cancelUnwrap: ReturnType<typeof vi.fn>
    } | null,
}))

vi.mock('expo', () => ({
    requireOptionalNativeModule: () => bindingMocks.module,
}))

import { RNBiometricsService } from '../services/biometrics'

const emptyBindingModule = {
    checkBinding: vi.fn(),
    clearBinding: vi.fn(),
    getAvailability: vi.fn(),
    armBinding: vi.fn().mockResolvedValue(null),
    beginUnwrap: vi.fn().mockResolvedValue(undefined),
    finishUnwrap: vi.fn().mockResolvedValue(new Uint8Array()),
    cancelUnwrap: vi.fn().mockResolvedValue(undefined),
}

const nativeError = (code: string): Error =>
    Object.assign(new Error('native failure'), { code })

const PROMPT = { title: 'Unlock', cancelLabel: 'Cancel' }

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

    describe('enrollment binding', () => {
        const nativeModule = {
            ...emptyBindingModule,
            checkBinding: vi.fn(),
            clearBinding: vi.fn(),
            getAvailability: vi.fn(),
        }

        beforeEach(() => {
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

        test('swallows a throwing clearBinding rather than rejecting', async () => {
            nativeModule.clearBinding.mockRejectedValue(new Error('keystore'))
            await expect(
                service.clearEnrollmentBinding(),
            ).resolves.toBeUndefined()
        })
    })

    describe('getAvailability', () => {
        const nativeModule = {
            ...emptyBindingModule,
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

    describe('armBiometricBinding', () => {
        it('passes the native ciphertext and hash straight through', async () => {
            bindingMocks.module = {
                ...emptyBindingModule,
                armBinding: vi
                    .fn()
                    .mockResolvedValue({ blob: 'ct', tokenHash: 'ab12' }),
            }

            const result = await new RNBiometricsService().armBiometricBinding()

            expect(result).toEqual({ blob: 'ct', tokenHash: 'ab12' })
        })

        it('resolves null when no native module is present', async () => {
            bindingMocks.module = null

            await expect(
                new RNBiometricsService().armBiometricBinding(),
            ).resolves.toBeNull()
        })

        it('resolves null when the native call throws', async () => {
            bindingMocks.module = {
                ...emptyBindingModule,
                armBinding: vi
                    .fn()
                    .mockRejectedValue(new Error('keystore full')),
            }

            await expect(
                new RNBiometricsService().armBiometricBinding(),
            ).resolves.toBeNull()
        })
    })

    describe('unwrapBiometricToken', () => {
        it('releases the token by finishing the session it began', async () => {
            const token = new Uint8Array([1, 2, 3])
            const beginUnwrap = vi.fn().mockResolvedValue(undefined)
            const finishUnwrap = vi.fn().mockResolvedValue(token)
            bindingMocks.module = {
                ...emptyBindingModule,
                beginUnwrap,
                finishUnwrap,
            }

            const result = await new RNBiometricsService().unwrapBiometricToken(
                'ct',
                PROMPT,
            )

            expect(result).toEqual({ success: true, token })
            expect(beginUnwrap).toHaveBeenCalledWith(PROMPT)
            expect(finishUnwrap).toHaveBeenCalledWith('ct')
        })

        it('does not finish after a failed ceremony', async () => {
            const finishUnwrap = vi.fn()
            bindingMocks.module = {
                ...emptyBindingModule,
                beginUnwrap: vi
                    .fn()
                    .mockRejectedValue(nativeError('user-cancel')),
                finishUnwrap,
            }

            const result = await new RNBiometricsService().unwrapBiometricToken(
                'ct',
                PROMPT,
            )

            expect(result).toEqual({ success: false, reason: 'user-cancel' })
            expect(finishUnwrap).not.toHaveBeenCalled()
        })

        it('reports no-binding when the native module is absent', async () => {
            bindingMocks.module = null

            const result = await new RNBiometricsService().unwrapBiometricToken(
                'ct',
                PROMPT,
            )

            expect(result).toEqual({ success: false, reason: 'no-binding' })
        })
    })

    describe('beginBiometricUnwrap', () => {
        it('forwards the caller prompt untouched, even when empty', async () => {
            const beginUnwrap = vi.fn().mockResolvedValue(undefined)
            bindingMocks.module = { ...emptyBindingModule, beginUnwrap }

            await new RNBiometricsService().beginBiometricUnwrap({
                title: '',
                cancelLabel: '',
            }).authenticated

            expect(beginUnwrap).toHaveBeenCalledWith({
                title: '',
                cancelLabel: '',
            })
        })

        it('resolves the ceremony before any blob is supplied', async () => {
            const finishUnwrap = vi.fn()
            bindingMocks.module = { ...emptyBindingModule, finishUnwrap }

            const session = new RNBiometricsService().beginBiometricUnwrap(
                PROMPT,
            )

            await expect(session.authenticated).resolves.toEqual({
                success: true,
            })
            expect(finishUnwrap).not.toHaveBeenCalled()
        })

        it.each([
            'invalidated',
            'decrypt-failed',
            'no-binding',
            'user-cancel',
            'system-cancel',
            'lockout',
            'unavailable',
            'failed',
        ])('maps a ceremony rejected with %s to that reason', async code => {
            bindingMocks.module = {
                ...emptyBindingModule,
                beginUnwrap: vi.fn().mockRejectedValue(nativeError(code)),
            }

            const session = new RNBiometricsService().beginBiometricUnwrap(
                PROMPT,
            )

            await expect(session.authenticated).resolves.toEqual({
                success: false,
                reason: code,
            })
        })

        it.each(['invalidated', 'decrypt-failed', 'failed'])(
            'maps a finish rejected with %s to that reason',
            async code => {
                bindingMocks.module = {
                    ...emptyBindingModule,
                    finishUnwrap: vi.fn().mockRejectedValue(nativeError(code)),
                }

                const session = new RNBiometricsService().beginBiometricUnwrap(
                    PROMPT,
                )

                await expect(session.finish('ct')).resolves.toEqual({
                    success: false,
                    reason: code,
                })
            },
        )

        it('maps an unrecognized native code to unknown', async () => {
            bindingMocks.module = {
                ...emptyBindingModule,
                beginUnwrap: vi
                    .fn()
                    .mockRejectedValue(nativeError('something-new')),
            }

            const session = new RNBiometricsService().beginBiometricUnwrap(
                PROMPT,
            )

            await expect(session.authenticated).resolves.toEqual({
                success: false,
                reason: 'unknown',
            })
        })

        it('cancels natively and swallows a cancel that throws', async () => {
            const cancelUnwrap = vi.fn().mockRejectedValue(new Error('gone'))
            bindingMocks.module = { ...emptyBindingModule, cancelUnwrap }

            const session = new RNBiometricsService().beginBiometricUnwrap(
                PROMPT,
            )

            await expect(session.cancel()).resolves.toBeUndefined()
            expect(cancelUnwrap).toHaveBeenCalledTimes(1)
        })

        it('reports no-binding for every step when the native module is absent', async () => {
            bindingMocks.module = null

            const session = new RNBiometricsService().beginBiometricUnwrap(
                PROMPT,
            )

            await expect(session.authenticated).resolves.toEqual({
                success: false,
                reason: 'no-binding',
            })
            await expect(session.finish('ct')).resolves.toEqual({
                success: false,
                reason: 'no-binding',
            })
        })
    })
})
