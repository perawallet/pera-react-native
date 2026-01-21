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
    isSensorAvailable,
    authenticateWithOptions,
    BiometricStrength,
} from '@sbaiahmed1/react-native-biometrics'
import type {
    BiometricsService,
    BiometricType,
} from '@perawallet/wallet-core-platform-integration'

export class RNBiometricsService implements BiometricsService {
    async getSupportedBiometricType(): Promise<BiometricType> {
        const { available, biometryType } = await isSensorAvailable()

        if (!available) {
            return null
        }

        switch (biometryType) {
            case 'FaceID':
                return 'face'
            case 'TouchID':
                return 'fingerprint'
            case 'Biometrics':
                return 'biometrics'
            default:
                return null
        }
    }

    async checkBiometricsAvailable(): Promise<boolean> {
        const biometryType = await this.getSupportedBiometricType()
        return biometryType !== null
    }

    async authenticate(
        promptTitle: string = 'Authenticate',
        promptDescription: string = 'Use biometrics to authenticate',
    ): Promise<boolean> {
        try {
            const result = await authenticateWithOptions({
                title: promptTitle,
                description: promptDescription,
                biometricStrength: BiometricStrength.Strong,
            })

            return result.success
        } catch {
            return false
        }
    }
}
