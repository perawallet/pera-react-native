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
    getEnrolledLevelAsync,
    hasHardwareAsync,
    isEnrolledAsync,
    supportedAuthenticationTypesAsync,
} from 'expo-local-authentication'
import { logger } from '@perawallet/wallet-core-shared'
import type {
    BiometricArmResult,
    BiometricAvailability,
    BiometricEnrollmentBinding,
    BiometricSecurityLevel,
    BiometricsAuthenticatePrompt,
    BiometricsService,
    BiometricType,
    BiometricUnwrapFailureReason,
    BiometricUnwrapResult,
} from '@perawallet/wallet-extension-platform'

const LOG_SOURCE = 'RNBiometricsService'

/** `apps/mobile/native-modules/biometric-binding`. */
interface NativePeraBiometricBinding {
    checkBinding(): Promise<string>
    clearBinding(): Promise<void>
    getAvailability(): Promise<string>
    armBinding(): Promise<{ blob: string; tokenHash: string } | null>
    unwrapToken(
        blob: string,
        prompt: { title: string; cancelLabel: string },
    ): Promise<Uint8Array>
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

const UNWRAP_FAILURE_REASONS = [
    'invalidated',
    'decrypt-failed',
    'no-binding',
    'user-cancel',
    'system-cancel',
    'lockout',
    'unavailable',
    'failed',
] as const satisfies readonly BiometricUnwrapFailureReason[]

// Only the native side can tell a destroyed key from a declined prompt, so it
// classifies and this only maps; an unrecognized code degrades rather than
// guessing.
const mapUnwrapFailureReason = (
    error: unknown,
): BiometricUnwrapFailureReason => {
    const code = (error as { code?: unknown } | null)?.code
    return UNWRAP_FAILURE_REASONS.find(reason => reason === code) ?? 'unknown'
}

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

    async armBiometricBinding(): Promise<BiometricArmResult | null> {
        const module = getBindingModule()
        if (!module) return null
        try {
            return (await module.armBinding()) ?? null
        } catch (error) {
            logger.error('Arming the biometric binding failed', {
                source: LOG_SOURCE,
                error,
            })
            return null
        }
    }

    async unwrapBiometricToken(
        blob: string,
        prompt: BiometricsAuthenticatePrompt,
    ): Promise<BiometricUnwrapResult> {
        const module = getBindingModule()
        // No module means no key, which is indistinguishable from a key that
        // was never created — and both are recoverable by re-opting in.
        if (!module) return { success: false, reason: 'no-binding' }
        try {
            const token = await module.unwrapToken(blob, prompt)
            return { success: true, token }
        } catch (error) {
            const reason = mapUnwrapFailureReason(error)
            logger.warn('Biometric unwrap did not succeed', {
                source: LOG_SOURCE,
                reason,
            })
            return { success: false, reason }
        }
    }
}
