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

import { requireOptionalNativeModule } from 'expo'
import {
    AuthenticationType,
    SecurityLevel,
    authenticateAsync,
    getEnrolledLevelAsync,
    hasHardwareAsync,
    isEnrolledAsync,
    supportedAuthenticationTypesAsync,
} from 'expo-local-authentication'
import { logger } from '@perawallet/wallet-core-shared'
import type {
    BiometricAvailability,
    BiometricEnrollmentBinding,
    BiometricSecurityLevel,
    BiometricsAuthenticateFailureReason,
    BiometricsAuthenticatePrompt,
    BiometricsAuthenticateResult,
    BiometricsService,
    BiometricType,
} from '@perawallet/wallet-extension-platform'

const LOG_SOURCE = 'RNBiometricsService'

/** `apps/mobile/native-modules/biometric-binding`. */
interface NativePeraBiometricBinding {
    createBinding(): Promise<boolean>
    checkBinding(): Promise<string>
    clearBinding(): Promise<void>
    getAvailability(): Promise<string>
}

const AVAILABILITIES: readonly BiometricAvailability[] = [
    'available',
    'none-enrolled',
    'denied',
    'unavailable',
    'unknown',
]

const asAvailability = (status: string): BiometricAvailability =>
    (AVAILABILITIES as readonly string[]).includes(status)
        ? (status as BiometricAvailability)
        : 'unknown'

const getBindingModule = (): NativePeraBiometricBinding | null =>
    requireOptionalNativeModule<NativePeraBiometricBinding>(
        'PeraBiometricBinding',
    )

const BINDING_STATUSES: readonly BiometricEnrollmentBinding[] = [
    'valid',
    'changed',
    'absent',
    'unavailable',
]

// 'changed' destroys the user's opt-in, so an unrecognized native string must
// never fall through to it.
const asBinding = (status: string): BiometricEnrollmentBinding =>
    (BINDING_STATUSES as readonly string[]).includes(status)
        ? (status as BiometricEnrollmentBinding)
        : 'unavailable'

// Unmapped errors fall through to 'unknown': iOS returns prefixed strings
// ("unknown: <code>") and strings outside the TS union. Android folds its OS
// cancel into 'user_cancel', so 'system-cancel' is iOS-only.
const AUTH_FAILURE_REASONS: Record<
    string,
    BiometricsAuthenticateFailureReason
> = {
    user_cancel: 'user-cancel',
    user_fallback: 'user-cancel',
    system_cancel: 'system-cancel',
    app_cancel: 'system-cancel',
    lockout: 'lockout',
    not_available: 'unavailable',
    not_enrolled: 'unavailable',
    passcode_not_set: 'unavailable',
    authentication_failed: 'failed',
}

const mapAuthFailureReason = (
    error: string | undefined,
): BiometricsAuthenticateFailureReason =>
    (error && AUTH_FAILURE_REASONS[error]) || 'unknown'

// Backed by `expo-local-authentication` (Expo SDK 57), which on iOS uses
// LAPolicy.deviceOwnerAuthenticationWithBiometrics and on Android uses the
// AndroidX BiometricPrompt. We force biometric-only by disabling the device
// PIN/password fallback — Pera has its own PIN flow and the
// `BiometricsService` contract is "biometric or nothing."
export class RNBiometricsService implements BiometricsService {
    async getSupportedBiometricType(): Promise<BiometricType> {
        const hasHardware = await hasHardwareAsync()
        if (!hasHardware) return null

        const isEnrolled = await isEnrolledAsync()
        if (!isEnrolled) return null

        const types = await supportedAuthenticationTypesAsync()
        if (types.includes(AuthenticationType.FACIAL_RECOGNITION)) return 'face'
        if (types.includes(AuthenticationType.FINGERPRINT)) return 'fingerprint'
        if (types.includes(AuthenticationType.IRIS)) return 'biometrics'
        return null
    }

    async checkBiometricsAvailable(): Promise<boolean> {
        return (await this.getSupportedBiometricType()) !== null
    }

    async getSecurityLevel(): Promise<BiometricSecurityLevel> {
        try {
            const level = await getEnrolledLevelAsync()
            switch (level) {
                case SecurityLevel.BIOMETRIC_STRONG: {
                    return 'strong'
                }
                // BIOMETRIC_WEAK shares its numeric value with the deprecated
                // `BIOMETRIC` member, so this also covers legacy reports.
                case SecurityLevel.BIOMETRIC_WEAK: {
                    return 'weak'
                }
                case SecurityLevel.SECRET: {
                    return 'secret'
                }
                default: {
                    return 'none'
                }
            }
        } catch (error) {
            // Older OS versions / unsupported hardware can throw rather than
            // reporting NONE. Treat as "can't confirm a strong biometric".
            logger.warn('getEnrolledLevelAsync threw', {
                source: LOG_SOURCE,
                error,
            })
            return 'none'
        }
    }

    async authenticate(
        prompt: BiometricsAuthenticatePrompt = {},
    ): Promise<BiometricsAuthenticateResult> {
        try {
            const result = await authenticateAsync({
                promptMessage: prompt.title ?? 'Authenticate',
                cancelLabel: prompt.cancelLabel || 'Cancel',
                disableDeviceFallback: true,
                // The single choke point for both enrollment and unlock, so
                // requiring class-3 means a spoofable "weak" modality can
                // neither be bound nor used to unlock. Weak-only Android devices
                // fail the OS prompt and fall back to PIN; iOS ignores this,
                // since Face ID / Touch ID are always strong.
                //
                // Deliberately stricter than the legacy Android app, which uses
                // BIOMETRIC_WEAK for unlock.
                biometricsSecurityLevel: 'strong',
            })
            if (!result.success) {
                logger.warn('Biometric authentication did not succeed', {
                    source: LOG_SOURCE,
                    error: result.error ?? null,
                    warning: result.warning ?? null,
                })
                return {
                    success: false,
                    reason: mapAuthFailureReason(result.error),
                }
            }
            return { success: true }
        } catch (error) {
            logger.error('Biometric authentication threw', {
                source: LOG_SOURCE,
                error,
            })
            return { success: false, reason: 'unknown' }
        }
    }

    async getAvailability(): Promise<BiometricAvailability> {
        const module = getBindingModule()
        // Without the native module there is no status code to read. 'unknown'
        // is the value that changes nothing, and `checkBiometricsAvailable`
        // still answers the yes/no question on its own.
        if (!module) return 'unknown'
        try {
            return asAvailability(await module.getAvailability())
        } catch (error) {
            logger.warn('getAvailability native call threw', {
                source: LOG_SOURCE,
                error,
            })
            return 'unknown'
        }
    }

    async createEnrollmentBinding(): Promise<void> {
        const module = getBindingModule()
        if (!module) return
        try {
            const created = await module.createBinding()
            if (!created) {
                logger.warn('Biometric enrollment binding was not recorded', {
                    source: LOG_SOURCE,
                })
            }
        } catch (error) {
            logger.warn('createBinding native call threw', {
                source: LOG_SOURCE,
                error,
            })
        }
    }

    async checkEnrollmentBinding(): Promise<BiometricEnrollmentBinding> {
        const module = getBindingModule()
        // A build without the module (or the web bundle) can't report, and
        // 'unavailable' is the reading that changes nothing.
        if (!module) return 'unavailable'
        try {
            return asBinding(await module.checkBinding())
        } catch (error) {
            logger.warn('checkBinding native call threw', {
                source: LOG_SOURCE,
                error,
            })
            return 'unavailable'
        }
    }

    async clearEnrollmentBinding(): Promise<void> {
        const module = getBindingModule()
        if (!module) return
        try {
            await module.clearBinding()
        } catch (error) {
            logger.warn('clearBinding native call threw', {
                source: LOG_SOURCE,
                error,
            })
        }
    }
}
