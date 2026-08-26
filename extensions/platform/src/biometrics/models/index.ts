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

/**
 * Whether the biometric set enrolled right now is the one the user opted in
 * with. Neither {@link BiometricsService.checkBiometricsAvailable} nor
 * {@link BiometricsService.getSecurityLevel} can answer this: remove-then-add
 * of a fingerprint never passes through an observable bad state, so both keep
 * reporting an enrolled strong biometric across the change.
 *
 * - `valid`       — unchanged since the binding was recorded.
 * - `changed`     — a biometric was added, or all of them removed. The only
 *                   affirmative report here, and the only one that may destroy
 *                   an opt-in.
 * - `absent`      — nothing recorded: opted in before bindings existed, or
 *                   arrived through the legacy-app migration.
 * - `unavailable` — no reading could be taken (no native module, nothing
 *                   enrolled to read, a lockout hiding the enrollment, a native
 *                   failure). Not a revocation.
 */
export type BiometricEnrollmentBinding =
    | 'valid'
    | 'changed'
    | 'absent'
    | 'unavailable'

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
    /**
     * Records the currently enrolled biometric set as the bound one. Call after
     * the opt-in prompt succeeds, and never on its own — a binding without the
     * secret it guards is meaningless.
     */
    createEnrollmentBinding(): Promise<void>
    /**
     * Never prompts: it runs on every mount of the biometrics hook, so it has
     * to be silent.
     */
    checkEnrollmentBinding(): Promise<BiometricEnrollmentBinding>
    clearEnrollmentBinding(): Promise<void>
}
