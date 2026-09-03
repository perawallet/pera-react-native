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

import type {
    DeviceInfoService,
    DevicePlatform,
    AppEnvironment,
} from '@perawallet/wallet-extension-platform'
import * as Application from 'expo-application'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { getLocales } from 'expo-localization'
import { config } from '@perawallet/wallet-core-config'

const buildUserAgent = () => {
    return `${Application.applicationName}/${Application.nativeApplicationVersion}.${Application.nativeBuildVersion} \
  (${Platform.OS}; ${Device.modelName}; ${Device.osVersion}) \
  pera_${Platform.OS}_${Application.nativeApplicationVersion}`
}

export class RNDeviceInfoStorageService implements DeviceInfoService {
    // `getLocales()` is a native read and `getDeviceLocale()` is called per
    // rendered row (via currency formatting). The device locale doesn't change
    // while the app is running, so resolve it once and cache it on the
    // (singleton) service instance.
    private cachedDeviceLocale: string | undefined
    private cachedDeviceLocales: string[] | undefined

    async getDeviceInstallationID(): Promise<string> {
        if (Platform.OS === 'ios') {
            return (await Application.getIosIdForVendorAsync()) ?? ''
        }
        return Application.getAndroidId() ?? ''
    }
    getDeviceModel(): string {
        return Device.modelName ?? ''
    }
    getDevicePlatform(): DevicePlatform {
        return Platform.OS as DevicePlatform
    }
    getDeviceLocale(): string {
        if (this.cachedDeviceLocale === undefined) {
            const locales = getLocales()
            this.cachedDeviceLocale =
                locales.map(l => l.languageTag).at(0) ?? 'en-US'
        }
        return this.cachedDeviceLocale
    }
    getDeviceLocales(): string[] {
        if (this.cachedDeviceLocales === undefined) {
            this.cachedDeviceLocales = getLocales().map(l => l.languageTag)
        }
        return this.cachedDeviceLocales
    }
    getDeviceOSVersion(): string {
        return Device.osVersion ?? ''
    }
    getDeviceModelId(): string {
        return Device.modelId ?? ''
    }
    getUserAgent(): string {
        return buildUserAgent()
    }
    getAppVersion(): string {
        return Application.nativeApplicationVersion ?? ''
    }
    getAppBuild(): string {
        return Application.nativeBuildVersion ?? ''
    }
    getAppId(): string {
        return config.appStoreAppID
    }
    getAppPackage(): string {
        return Application.applicationId ?? ''
    }
    getAppName(): string {
        return Application.applicationName ?? ''
    }
    getDeviceCountry(): string {
        const locales = getLocales()
        return locales[0]?.regionCode ?? 'US'
    }
    getAppEnvironment(): AppEnvironment {
        return config.appEnvironment
    }
    isStoreBuild(): boolean {
        return config.appEnvironment === 'production'
    }
}
