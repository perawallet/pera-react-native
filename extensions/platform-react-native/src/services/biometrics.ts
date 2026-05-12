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

import {
    AuthenticationType,
    authenticateAsync,
    hasHardwareAsync,
    isEnrolledAsync,
    supportedAuthenticationTypesAsync,
} from 'expo-local-authentication'
import { logger } from '@perawallet/wallet-core-shared'
import type {
    BiometricsAuthenticatePrompt,
    BiometricsService,
    BiometricType,
} from '@perawallet/wallet-extension-platform'

const LOG_SOURCE = 'RNBiometricsService'

// Backed by `expo-local-authentication` (Expo SDK 55), which on iOS uses
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

    async authenticate(
        prompt: BiometricsAuthenticatePrompt = {},
    ): Promise<boolean> {
        try {
            const result = await authenticateAsync({
                promptMessage: prompt.title ?? 'Authenticate',
                cancelLabel: prompt.cancelLabel || 'Cancel',
                disableDeviceFallback: true,
                biometricsSecurityLevel: 'weak',
            })
            if (!result.success) {
                logger.warn('Biometric authentication did not succeed', {
                    source: LOG_SOURCE,
                    error: result.error ?? null,
                    warning: result.warning ?? null,
                })
            }
            return result.success
        } catch (error) {
            logger.error('Biometric authentication threw', {
                source: LOG_SOURCE,
                error,
            })
            return false
        }
    }
}
