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
import type {
    BiometricsService,
    BiometricType,
} from '@perawallet/wallet-extension-platform'

// Backed by `expo-local-authentication` (Expo SDK 55), which on iOS uses
// LAPolicy.deviceOwnerAuthenticationWithBiometrics and on Android uses the
// AndroidX BiometricPrompt with BIOMETRIC_STRONG. We force biometric-only by
// disabling the device PIN/password fallback — Pera has its own PIN flow and
// the `BiometricsService` contract is "biometric or nothing."
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
        promptTitle: string = 'Authenticate',
        // expo-local-authentication doesn't expose a separate "description"
        // field. Kept in the signature for `BiometricsService` API
        // compatibility; ignored at runtime.
        _promptDescription?: string,
    ): Promise<boolean> {
        try {
            const result = await authenticateAsync({
                promptMessage: promptTitle,
                disableDeviceFallback: true,
                biometricsSecurityLevel: 'strong',
            })
            return result.success
        } catch {
            return false
        }
    }
}
