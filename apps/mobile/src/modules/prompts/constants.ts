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

/**
 * Order in which blocking interruptions claim the screen. Everything that
 * interrupts the user goes through one queue — before this, prompts and
 * auto-opening banners each decided independently when to appear, so a
 * post-migration launch showed them in whatever order their triggers happened
 * to fire (PERA-4874).
 *
 * Gaps are intentional: a new interruption should slot between existing ones
 * without renumbering.
 */
export const PromptPriority = {
    /** Legally mandatory — must be answered before anything else. */
    termsAcceptance: 400,
    /** May carry a forced update notice, so it outranks every nudge. */
    forcedBanner: 300,
    /** A nudge; the user can carry on without answering. */
    securityPinSetup: 200,
    /**
     * A nudge, but about protection the user already had and just lost, so it
     * outranks the purely informational notices below it.
     */
    biometricsDisabled: 175,
    /**
     * A nudge, informational about an existing account's recovery-phrase
     * behaviour rather than a security setup step — more important than the
     * softest banner, less urgent than the PIN setup nudge.
     */
    legacyQuantumNotice: 150,
    /** Banners marked autoOpenMode: 'select' — the softest interruption. */
    autoOpenBanner: 100,
} as const
