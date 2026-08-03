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

export type AppEnvironment = 'development' | 'staging' | 'production'

export const DevicePlatforms = {
    ios: 'ios',
    android: 'android',
    web: 'web',
} as const

export type DevicePlatform =
    (typeof DevicePlatforms)[keyof typeof DevicePlatforms]

export interface DeviceInfoService {
    getAppName(): string
    getAppId(): string
    getAppPackage(): string
    getAppBuild(): string
    getAppVersion(): string
    /**
     * Stable per-install identifier: iOS `identifierForVendor`, the Android ID,
     * or a stored UUID on web. Resettable by the user (reinstall, factory
     * reset, clearing storage) — treat it as a handle, not a hard identity.
     *
     * Not the backend device row id (`useDeviceID` in
     * `@perawallet/wallet-core-device`), which is server-assigned, per-network,
     * and recreated whenever the server stops recognising it.
     */
    getDeviceInstallationID(): Promise<string>
    getDeviceModel(): string
    getDevicePlatform(): DevicePlatform
    getDeviceOSVersion(): string
    getDeviceLocale(): string
    getDeviceCountry(): string
    getDeviceModelId(): string
    getUserAgent(): string
    getAppEnvironment(): AppEnvironment
    isStoreBuild(): boolean
}
