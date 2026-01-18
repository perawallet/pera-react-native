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

export type BiometricType = 'face' | 'fingerprint' | 'iris' | null

export interface BiometricsService {
    /**
     * Get the supported biometric type on this device
     */
    getSupportedBiometricType(): Promise<BiometricType>

    /**
     * Check if biometrics are available on this device
     */
    isBiometricAvailable(): Promise<boolean>

    /**
     * Prompt the user to authenticate with biometrics
     * @param promptTitle The title to display in the biometric prompt
     * @param promptDescription The description to display in the biometric prompt
     * @returns true if authentication succeeded, false otherwise
     */
    authenticate(
        promptTitle?: string,
        promptDescription?: string,
    ): Promise<boolean>
}
