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
    type DeviceInfoService,
    type DevicePlatform,
} from '@perawallet/wallet-core-platform-integration'
import { updateBackendHeaders } from '@perawallet/wallet-core-shared'
import * as Application from 'expo-application'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { getLocales } from 'expo-localization'
import { config } from '@perawallet/wallet-core-config'

const findDeviceLocale = () => {
    const locales = getLocales()
    return locales.map(l => l.languageTag).at(0) ?? 'en-US'
}

const buildUserAgent = () => {
    return `${Application.applicationName}/${Application.nativeApplicationVersion}.${Application.nativeBuildVersion} \
  (${Platform.OS}; ${Device.modelName}; ${Device.osVersion}) \
  pera_${Platform.OS}_${Application.nativeApplicationVersion}`
}

export class RNDeviceInfoStorageService implements DeviceInfoService {
    initializeDeviceInfo(): void {
        const headers = new Map<string, string>()
        headers.set('App-Name', Application.applicationName ?? '')
        headers.set('App-Package-Name', Application.applicationId ?? '')
        headers.set('App-Version', Application.nativeApplicationVersion ?? '')
        headers.set('Client-Type', Platform.OS)
        headers.set('Device-Version', findDeviceLocale())
        headers.set('Device-OS-Version', Device.osVersion ?? '')
        headers.set('Device-Model', Device.modelId ?? '')
        headers.set('User-Agent', buildUserAgent())

        updateBackendHeaders(headers)
    }
    async getDeviceID(): Promise<string> {
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
        return findDeviceLocale()
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
}
