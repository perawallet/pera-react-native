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
} as const

export type RemoteConfigKey =
    (typeof RemoteConfigKeys)[keyof typeof RemoteConfigKeys]

export const RemoteConfigDefaults: Record<
    RemoteConfigKey,
    string | boolean | number
> = {
    welcome_message: 'Hello',
}

export type RemoteConfigStore = {
    configOverrides: Record<string, string | boolean | number>
    setConfigOverride: (
        key: string,
        value: string | boolean | number | null,
    ) => void
    resetState: () => void
}

export interface RemoteConfigService {
    initializeRemoteConfig(): void
    getStringValue(key: RemoteConfigKey, fallback?: string): string
    getBooleanValue(key: RemoteConfigKey, fallback?: boolean): boolean
    getNumberValue(key: RemoteConfigKey, fallback?: number): number
}
