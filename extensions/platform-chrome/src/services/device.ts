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

import {
    DevicePlatforms,
    type AppEnvironment,
    type DeviceInfoService,
    type DevicePlatform,
} from '@perawallet/wallet-extension-platform'
import { config } from '@perawallet/wallet-core-config'
import { ensureDeviceID } from '../device-id'
import { detectBrowser } from './browser'

export class ChromeDeviceInfoService implements DeviceInfoService {
    private idPromise: Promise<string> | null = null

    getAppName(): string {
        return chrome.runtime.getManifest().name
    }

    getAppId(): string {
        return chrome.runtime.id
    }

    getAppPackage(): string {
        return chrome.runtime.id
    }

    getAppBuild(): string {
        // Mirrors mobile's nativeBuildVersion — the incrementing CI build
        // number, not the semantic manifest version. Falls back to the
        // manifest version for local builds where BITRISE_BUILD_NUMBER is unset.
        return config.appBuildNumber || chrome.runtime.getManifest().version
    }

    getAppVersion(): string {
        return chrome.runtime.getManifest().version
    }

    async getDeviceID(): Promise<string> {
        // Collapses concurrent callers in this context to one storage
        // round-trip; cross-context convergence lives in ensureDeviceID.
        this.idPromise ??= ensureDeviceID()
        return this.idPromise
    }

    getDeviceModel(): string {
        return detectBrowser().name
    }

    getDevicePlatform(): DevicePlatform {
        return DevicePlatforms.web
    }

    getDeviceOSVersion(): string {
        return detectBrowser().osVersion
    }

    getDeviceLocale(): string {
        return navigator.language
    }

    getDeviceCountry(): string {
        return navigator.language.split('-')[1] ?? ''
    }

    getDeviceModelId(): string {
        return detectBrowser().version
    }

    getUserAgent(): string {
        // Mirror mobile's buildUserAgent format so shared backend/Cloudflare
        // rules (rate limiting etc.) parse it the same way. Mobile emits e.g.
        // `Pera/7.0.0.1234 (ios; iPhone14,2; 17.0) pera_ios_7.0.0`; the web
        // build substitutes the browser name/version for the device model and
        // `web` for the platform token.
        const platform = this.getDevicePlatform()
        const version = this.getAppVersion()
        const { name, version: browserVersion, osVersion } = detectBrowser()
        return (
            `${this.getAppName()}/${version}.${this.getAppBuild()} ` +
            `(${platform}; ${name} ${browserVersion}; ${osVersion}) ` +
            `pera_${platform}_${version}`
        )
    }

    getAppEnvironment(): AppEnvironment {
        // EXPO_PUBLIC_* vars are inlined at build time (Metro bundles this package for the extension's UI surfaces via expo export).
        const env = process.env.EXPO_PUBLIC_APP_ENV
        if (env === 'staging' || env === 'production') return env
        return 'development'
    }

    isStoreBuild(): boolean {
        // Store-installed extensions carry an update_url; unpacked dev builds don't.
        return typeof chrome.runtime.getManifest().update_url === 'string'
    }
}
