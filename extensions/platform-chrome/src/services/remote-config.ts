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
import { config, isDebug } from '@perawallet/wallet-core-config'
import { getFirebaseApp } from './firebase-app'

/** Serves bundled defaults when unconfigured; fetches real Firebase Remote
 * Config values once a Firebase project (firebaseProjectId) is registered. */
export class ChromeRemoteConfigService implements RemoteConfigService {
    private remoteConfig: RemoteConfig | null = null

    async initializeRemoteConfig(): Promise<void> {
        const app = getFirebaseApp()
        if (!app) {
            const message =
                '[pera] Remote Config disabled: no Firebase project configured; serving bundled defaults'
            if (isDebug) {
                console.warn(message, { appEnvironment: config.appEnvironment })
            } else {
                console.error(message, {
                    appEnvironment: config.appEnvironment,
                })
            }
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
        } catch (error) {
            // Still non-fatal — cached/default values carry the app — but a
            // blocked host permission or a bad API key looks identical to
            // "flag is off" from the UI, so leave a trace.
            console.warn(
                '[pera] Remote Config fetch failed; using cached/defaults',
                error,
            )
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
            // Only a genuinely fetched value counts. Every key is seeded via
            // defaultConfig so getValue never throws pre-fetch, but treating
            // that seed as real would let a bundled default silently override
            // the caller's fallback — e.g. `enable_pera_card` is bundled
            // `false`, so a dev/staging caller passing `true` would still see
            // Pera Card hidden until the first successful fetch.
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
