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

export const RemoteConfigKeys = {
    disable_screen_capture_prevention: 'disable_screen_capture_prevention',
    welcome_message: 'welcome_message',
    fee_warning_standard_fee: 'fee_warning_standard_fee',
    fee_warning_usd_threshold: 'fee_warning_usd_threshold',
    fee_min_txn_fee: 'fee_min_txn_fee',
    fee_pq_multiplier: 'fee_pq_multiplier',
    fee_asset_mbr: 'fee_asset_mbr',
    fee_base_account_mbr: 'fee_base_account_mbr',
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
    enable_ssl_pinning_pera_api: 'enable_ssl_pinning_pera_api',
    enable_ssl_pinning_algod: 'enable_ssl_pinning_algod',
    terms_version: 'terms_version',
    network_reachability_url: 'network_reachability_url',
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
    // Minimum transaction fee in µAlgo.
    fee_min_txn_fee: 1000,
    // Multiplier applied to the minimum fee for post-quantum signers.
    fee_pq_multiplier: 3,
    // Additional minimum balance requirement per opted-in asset, in µAlgo.
    fee_asset_mbr: 100_000,
    // Base minimum balance requirement for any account, in µAlgo.
    fee_base_account_mbr: 100_000,
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
    // SSL public-key pinning for perawallet.app API hosts. getBooleanValue only
    // trusts genuinely fetched values, so pinning stays OFF until Firebase has
    // delivered an explicit true at least once (fetched values persist across
    // launches) — and flipping the flag off in the console is the remote kill
    // switch: Firebase's own hosts are never pinned, so a broken pin set cannot
    // lock the app out of receiving the disable.
    enable_ssl_pinning_pera_api: false,
    // Same contract as enable_ssl_pinning_pera_api, but for the Algorand node/indexer
    // (Nodely) hosts — a separate kill switch so a node-side CA surprise can be
    // disabled without also dropping backend pinning, and vice versa.
    enable_ssl_pinning_algod: false,
    // Bump to re-prompt every user for Terms & Conditions acceptance. The app
    // compares this against the last version the user accepted (stored on disk).
    terms_version: '1',
    // Endpoint used to actively probe internet reachability. MUST return HTTP
    // 204 with an empty body (a captive portal answering 200 + HTML is thereby
    // detected as unreachable). Overridable via Remote Config without a
    // redeploy; defaults to Google's generate_204 interim.
    network_reachability_url: 'https://clients3.google.com/generate_204',
}

export interface RemoteConfigService {
    // Async on every implementation (both fetch-and-activate against a remote
    // backend), and both platform extensions already await it in their
    // `initialize()` — declaring it `void` here only hid that from the type
    // checker and let a caller read flags before activation had landed.
    initializeRemoteConfig(): Promise<void>
    getStringValue(key: string, fallback?: string): string
    getBooleanValue(key: string, fallback?: boolean): boolean
    getNumberValue(key: string, fallback?: number): number
}
