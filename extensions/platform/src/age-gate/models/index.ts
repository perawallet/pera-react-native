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

// Single age threshold for the gate.
export const ADULT_AGE = 18

/**
 * Normalized age decision. Display/business layers never see Apple/Google
 * specifics — the platform impl collapses both OSes into this.
 */
export type AgeGateStatus = 'adult' | 'minor' | 'unknown'

export type AgeGateSource = 'platform' | 'self-declared'

export type AgeGateResult = {
    status: AgeGateStatus
    source: AgeGateSource
}

/**
 * Device capability only:
 *   'platform' — a usable native age API exists (iOS 26+ entitled; Android
 *                where Play Age Signals returns data).
 *   'manual'   — no native age API; self-declare is the only mechanism.
 * The package layers a remote-config jurisdiction kill-switch on top to derive
 * the effective support level (which adds 'none').
 */
export type AgeGateDeviceCapability = 'platform' | 'manual'

export interface AgeGateService {
    /**
     * Triggers the iOS system age sheet / Android signal query. Never prompts
     * for PII. Returns 'unknown' when no usable signal is available.
     */
    requestAgeRange(minimumAge: number): Promise<AgeGateResult>
    getDeviceCapability(): Promise<AgeGateDeviceCapability>
}
