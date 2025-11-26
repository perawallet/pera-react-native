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
import DeviceInfo from 'react-native-device-info'
import { Platform, NativeModules } from 'react-native'

const findDeviceLocale = () => {
    const deviceLanguage =
        Platform.OS === 'ios'
            ? NativeModules.SettingsManager.getConstants().settings
                  .AppleLocale ||
              NativeModules.SettingsManager.getConstants().settings
                  .AppleLanguages[0]
            : NativeModules.I18nManager.getConstants().localeIdentifier

    return deviceLanguage.replaceAll('_', '-')
}

const buildUserAgent = () => {
    return `${DeviceInfo.getApplicationName()}/${DeviceInfo.getVersion()}.${DeviceInfo.getBuildNumber()} \
  (${Platform.OS}; ${DeviceInfo.getModel()}; ${DeviceInfo.getSystemVersion()}) \
  pera_${Platform.OS}_${DeviceInfo.getVersion()}`
}

export class RNDeviceInfoStorageService implements DeviceInfoService {
    initializeDeviceInfo(): void {
        const headers = new Map<string, string>()
        headers.set('App-Name', DeviceInfo.getApplicationName())
        headers.set('App-Package-Name', DeviceInfo.getBundleId())
        headers.set('App-Version', DeviceInfo.getVersion())
        headers.set('Client-Type', Platform.OS)
        headers.set('Device-Version', findDeviceLocale())
        headers.set('Device-OS-Version', DeviceInfo.getSystemVersion())
        headers.set('Device-Model', DeviceInfo.getDeviceId())
        headers.set('User-Agent', buildUserAgent())

        updateBackendHeaders(headers)
    }
    getDeviceID(): Promise<string> {
        return DeviceInfo.getUniqueId()
    }
    getDeviceModel(): string {
        return DeviceInfo.getModel()
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
        return DeviceInfo.getVersion()
    }
}
