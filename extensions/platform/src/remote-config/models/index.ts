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
    welcome_message: 'welcome_message',
    fee_warning_standard_fee: 'fee_warning_standard_fee',
    fee_warning_usd_threshold: 'fee_warning_usd_threshold',
    staking_projects: 'staking_projects',
    swap_price_impact_low_threshold: 'swap_price_impact_low_threshold',
    swap_price_impact_high_threshold: 'swap_price_impact_high_threshold',
} as const

export type RemoteConfigKey =
    (typeof RemoteConfigKeys)[keyof typeof RemoteConfigKeys]

export const RemoteConfigDefaults: Record<
    RemoteConfigKey,
    string | boolean | number
> = {
    welcome_message: 'Hello',
    fee_warning_standard_fee: 0.001,
    fee_warning_usd_threshold: 0.01,
    staking_projects: '',
    swap_price_impact_low_threshold: 1,
    swap_price_impact_high_threshold: 5,
}

export interface RemoteConfigService {
    initializeRemoteConfig(): void
    getStringValue(key: string, fallback?: string): string
    getBooleanValue(key: string, fallback?: boolean): boolean
    getNumberValue(key: string, fallback?: number): number
}
