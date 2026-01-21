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

export const UserPreferences = {
    spendAgreed: 'send-fund-agreed',
    chartVisible: 'chart-visible',
    developerMenuEnabled: 'developer-menu-enabled',

    //prompts (don't set these directly, they are set by the prompts module but held here to avoid accidental name collisions)
    securityPinSetupPrompt: 'security_pin_setup_prompt',
} as const

export type UserPreferences =
    (typeof UserPreferences)[keyof typeof UserPreferences]
