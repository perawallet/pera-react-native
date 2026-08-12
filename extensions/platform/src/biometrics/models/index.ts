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

export type BiometricType = 'face' | 'fingerprint' | 'biometrics' | null

/**
 * The strongest authentication the device currently has enrolled.
 *
 * - `none`   — no screen lock at all.
 * - `secret` — PIN / pattern / password only, no biometric.
 * - `weak`   — class-2 biometric (e.g. 2D face unlock). Not sufficient for
 *              hardware-backed credential providers that require
 *              `BIOMETRIC_STRONG`.
 * - `strong` — class-3 biometric (fingerprint / 3D face).
 *
 * Maps directly onto Android's `BiometricManager` strength classes. iOS only
 * ever reports `none` / `secret` / `strong` (Face ID & Touch ID are strong;
 * there is no weak tier).
 */
export type BiometricSecurityLevel = 'none' | 'secret' | 'weak' | 'strong'

export type BiometricsAuthenticatePrompt = {
    title?: string
    description?: string
    // Required on Android when device-credential fallback is disabled:
    // AndroidX BiometricPrompt rejects PromptInfo without a non-empty
    // negative button text. Ignored on iOS (LAContext provides its own).
    cancelLabel?: string
}

/**
 * Why an authenticate call failed. Only `system-cancel` (the OS dropping a
 * prompt without user action, e.g. the app was not active yet) is safe to
 * retry; every other reason is terminal. Android folds its OS cancel into
 * `user-cancel`, so `system-cancel` is effectively iOS-only.
 */
export type BiometricsAuthenticateFailureReason =
    | 'user-cancel'
    | 'system-cancel'
    | 'lockout'
    | 'unavailable'
    | 'failed'
    | 'unknown'

export type BiometricsAuthenticateResult =
    | { success: true }
    | { success: false; reason: BiometricsAuthenticateFailureReason }

export interface BiometricsService {
    getSupportedBiometricType(): Promise<BiometricType>
    checkBiometricsAvailable(): Promise<boolean>
    /**
     * The strongest enrolled authentication level. Distinct from
     * {@link checkBiometricsAvailable}, which only reports whether *some*
     * biometric exists — callers needing a hardware-backed (`strong`)
     * authenticator, such as the passkey credential provider, must check this.
     */
    getSecurityLevel(): Promise<BiometricSecurityLevel>
    authenticate(
        prompt?: BiometricsAuthenticatePrompt,
    ): Promise<BiometricsAuthenticateResult>
}
