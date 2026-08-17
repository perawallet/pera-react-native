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

export const UserPreferences = {
    transactionInfoAgreed: 'transaction-info-agreed',
    chartVisible: 'chart-visible',
    developerMenuEnabled: 'developer-menu-enabled',
    rekeySupportEnabled: 'rekey-support-enabled',
    assetFreezeSupportEnabled: 'asset-freeze-support-enabled',
    shakeToLockEnabled: 'shake-to-lock-enabled',

    transactionRequestFaqShown: 'transaction-request-faq-shown',
    stakingDisclaimerAccepted: 'staking-disclaimer-accepted',

    expressSendWarningDismissed: 'express-send-warning-dismissed',
    swapIntroductionSeen: 'swap-introduction-seen',
    onrampIntroductionSeen: 'onramp-introduction-seen',
    onrampXoTermsAccepted: 'onramp-xo-terms-accepted',
    quantumDappWarningAcknowledged: 'quantum-dapp-warning-acknowledged',

    // Web-only master toggle for WebAuthn interception. Deliberately
    // camelCase (breaking this map's kebab-case convention) — it must match
    // WEBAUTHN_TOGGLE_PREFERENCE_KEY in
    // apps/browser/src/content/webauthn-toggle.ts verbatim, since the
    // ISOLATED relay content script parses this exact string key out of the
    // persisted settings-store envelope. Do not "normalize" this value
    // without updating that parser too.
    webauthnInterceptionEnabled: 'webauthnInterceptionEnabled',

    //prompts (don't set these directly, they are set by the prompts module but held here to avoid accidental name collisions)
    _securityPinSetupPrompt: 'security_pin_setup_prompt',
} as const

type UserPreferences = (typeof UserPreferences)[keyof typeof UserPreferences]

// Preferences that gate first-run prompts, disclaimers, or one-shot warnings.
// The developer "Clear one-time flags" action iterates this list — add new
// keys here so they reset alongside the others.
export const OneTimeUserPreferenceFlags = [
    UserPreferences.transactionInfoAgreed,
    UserPreferences.transactionRequestFaqShown,
    UserPreferences.stakingDisclaimerAccepted,
    UserPreferences.expressSendWarningDismissed,
    UserPreferences.swapIntroductionSeen,
    UserPreferences.onrampIntroductionSeen,
    UserPreferences.onrampXoTermsAccepted,
    UserPreferences.quantumDappWarningAcknowledged,
    UserPreferences._securityPinSetupPrompt,
] as const
