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

import {
    fetchAndActivate,
    getRemoteConfig,
    getValue,
    type RemoteConfig,
} from 'firebase/remote-config'
import {
    RemoteConfigDefaults,
    type RemoteConfigKey,
    type RemoteConfigService,
} from '@perawallet/wallet-extension-platform'
import { config } from '@perawallet/wallet-core-config'
import { getFirebaseApp } from './firebase-app'

/** Serves bundled defaults when unconfigured; fetches real Firebase Remote
 * Config values once a Firebase project (firebaseProjectId) is registered. */
export class ChromeRemoteConfigService implements RemoteConfigService {
    private remoteConfig: RemoteConfig | null = null

    async initializeRemoteConfig(): Promise<void> {
        const app = getFirebaseApp()
        if (!app) {
            return
        }
        this.remoteConfig = getRemoteConfig(app)
        this.remoteConfig.settings = {
            ...this.remoteConfig.settings,
            minimumFetchIntervalMillis: config.remoteConfigRefreshTime,
        }
        this.remoteConfig.defaultConfig = RemoteConfigDefaults

        try {
            await fetchAndActivate(this.remoteConfig)
        } catch {
            // ignore fetch errors, rely on cached/default values
        }
    }

    getStringValue(key: string, fallback?: string): string {
        const defaultValue = RemoteConfigDefaults[key as RemoteConfigKey]
        const effectiveFallback =
            typeof defaultValue === 'string' ? defaultValue : (fallback ?? '')
        if (!this.remoteConfig) {
            return effectiveFallback
        }
        try {
            return getValue(this.remoteConfig, key).asString()
        } catch {
            return effectiveFallback
        }
    }

    getBooleanValue(key: string, fallback?: boolean): boolean {
        const defaultValue = RemoteConfigDefaults[key as RemoteConfigKey]
        const effectiveFallback =
            typeof defaultValue === 'boolean'
                ? defaultValue
                : (fallback ?? false)
        if (!this.remoteConfig) {
            return effectiveFallback
        }
        try {
            const value = getValue(this.remoteConfig, key)
            // Only trust a genuinely fetched value — mirrors
            // extensions/platform-react-native/src/services/firebase.ts,
            // which seeds every key via defaultConfig so getValue never
            // throws even pre-fetch; treating that seeded value as "real"
            // would let a stale default silently override the caller's
            // fallback. A non-remote source falls through to the caller's
            // `fallback`, not the bundled default: e.g.
            // useIsPeraCardEnabled calls
            // getBooleanValue('enable_pera_card', isDebug || isStaging) to
            // override the bundled `false` with `true` in dev/staging —
            // before the first successful fetch, getSource() is 'default',
            // and falling back to the bundled default would hide Pera Card.
            return value.getSource() === 'remote'
                ? value.asBoolean()
                : (fallback ?? false)
        } catch {
            return fallback ?? false
        }
    }

    getNumberValue(key: string, fallback?: number): number {
        const defaultValue = RemoteConfigDefaults[key as RemoteConfigKey]
        const effectiveFallback =
            typeof defaultValue === 'number' ? defaultValue : (fallback ?? 0)
        if (!this.remoteConfig) {
            return effectiveFallback
        }
        try {
            return getValue(this.remoteConfig, key).asNumber()
        } catch {
            return effectiveFallback
        }
    }
}
