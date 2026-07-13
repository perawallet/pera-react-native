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

const DEVICE_ID_KEY = 'device:id'

type NavigatorWithUAData = Navigator & {
    userAgentData?: { platform?: string }
}

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
        return chrome.runtime.getManifest().version
    }

    getAppVersion(): string {
        return chrome.runtime.getManifest().version
    }

    async getDeviceID(): Promise<string> {
        // Collapses concurrent callers in this context to one storage
        // round-trip so a first-run race can't mint two different IDs.
        this.idPromise ??= this.resolveDeviceID()
        return this.idPromise
    }

    private async resolveDeviceID(): Promise<string> {
        const stored = await chrome.storage.local.get(DEVICE_ID_KEY)
        const existing = stored[DEVICE_ID_KEY]
        if (typeof existing === 'string') return existing
        const id = crypto.randomUUID()
        await chrome.storage.local.set({ [DEVICE_ID_KEY]: id })
        return id
    }

    getDeviceModel(): string {
        return 'browser'
    }

    getDevicePlatform(): DevicePlatform {
        return DevicePlatforms.web
    }

    getDeviceOSVersion(): string {
        const nav = navigator as NavigatorWithUAData
        return nav.userAgentData?.platform ?? 'unknown'
    }

    getDeviceLocale(): string {
        return navigator.language
    }

    getDeviceCountry(): string {
        return navigator.language.split('-')[1] ?? ''
    }

    getDeviceModelId(): string {
        return 'browser'
    }

    getUserAgent(): string {
        return navigator.userAgent
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
