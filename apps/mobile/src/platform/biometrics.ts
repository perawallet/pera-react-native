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

import * as Keychain from 'react-native-keychain'
import type {
    BiometricsService,
    BiometricType,
} from '@perawallet/wallet-core-platform-integration'

const BIOMETRIC_TEST_SERVICE = 'com.algorand.android.biometric.test'

export class RNBiometricsService implements BiometricsService {
    async getSupportedBiometricType(): Promise<BiometricType> {
        const biometryType = await Keychain.getSupportedBiometryType()

        switch (biometryType) {
            case Keychain.BIOMETRY_TYPE.FACE_ID:
            case Keychain.BIOMETRY_TYPE.FACE:
                return 'face'
            case Keychain.BIOMETRY_TYPE.TOUCH_ID:
            case Keychain.BIOMETRY_TYPE.FINGERPRINT:
                return 'fingerprint'
            case Keychain.BIOMETRY_TYPE.IRIS:
                return 'iris'
            default:
                return null
        }
    }

    async isBiometricAvailable(): Promise<boolean> {
        const biometryType = await this.getSupportedBiometricType()
        return biometryType !== null
    }

    async authenticate(
        promptTitle: string = 'Authenticate',
        promptDescription: string = 'Use biometrics to authenticate',
    ): Promise<boolean> {
        try {
            // Store a test value with biometric access control
            await Keychain.setGenericPassword('biometric', 'test', {
                service: BIOMETRIC_TEST_SERVICE,
                accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
                accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
                authenticationPrompt: {
                    title: promptTitle,
                    description: promptDescription,
                },
                securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
            })

            // Try to read it back - this will trigger the biometric prompt
            const result = await Keychain.getGenericPassword({
                service: BIOMETRIC_TEST_SERVICE,
                authenticationPrompt: {
                    title: promptTitle,
                    description: promptDescription,
                },
            })

            // Clean up the test value
            await Keychain.resetGenericPassword({
                service: BIOMETRIC_TEST_SERVICE,
            })

            return result !== false
        } catch {
            return false
        }
    }
}
