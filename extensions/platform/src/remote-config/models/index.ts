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

export const RemoteConfigKeys = {
    disable_screen_capture_prevention: 'disable_screen_capture_prevention',
    welcome_message: 'welcome_message',
    fee_warning_standard_fee: 'fee_warning_standard_fee',
    fee_warning_usd_threshold: 'fee_warning_usd_threshold',
    staking_projects: 'staking_projects',
    swap_price_impact_low_threshold: 'swap_price_impact_low_threshold',
    swap_price_impact_high_threshold: 'swap_price_impact_high_threshold',
    enable_motion_lock: 'enable_motion_lock',
    enable_duress_pin: 'enable_duress_pin',
    pera_7_migration: 'pera_7_migration',
    force_platform_age_gate: 'force_platform_age_gate',
    onramp_currency_decimals: 'onramp_currency_decimals',
    enable_pera_card: 'enable_pera_card',
    enable_quantum_accounts: 'enable_quantum_accounts',
    enable_card_auto_funding: 'enable_card_auto_funding',
    terms_version: 'terms_version',
} as const

export type RemoteConfigKey =
    (typeof RemoteConfigKeys)[keyof typeof RemoteConfigKeys]

export const RemoteConfigDefaults: Record<
    RemoteConfigKey,
    string | boolean | number
> = {
    disable_screen_capture_prevention: false,
    welcome_message: 'Hello',
    fee_warning_standard_fee: 0.001,
    fee_warning_usd_threshold: 0.01,
    staking_projects: '',
    swap_price_impact_low_threshold: 1,
    swap_price_impact_high_threshold: 5,
    enable_motion_lock: false,
    enable_duress_pin: false,
    pera_7_migration: false,
    force_platform_age_gate: false,
    // JSON map of source-currency symbol -> max fraction digits, extending the
    // built-in onramp defaults. Empty string = no overrides.
    onramp_currency_decimals: '',
    enable_pera_card: false,
    enable_quantum_accounts: false,
    // Off in prod (the hook keeps it on in dev/staging). Gates the auto-funding
    // UI only; prod is stopped from signing an unpinned program by
    // verifyDelegationProgram, not by this flag.
    enable_card_auto_funding: false,
    // Bump to re-prompt every user for Terms & Conditions acceptance. The app
    // compares this against the last version the user accepted (stored on disk).
    terms_version: '1',
}

export interface RemoteConfigService {
    initializeRemoteConfig(): void
    getStringValue(key: string, fallback?: string): string
    getBooleanValue(key: string, fallback?: boolean): boolean
    getNumberValue(key: string, fallback?: number): number
}
