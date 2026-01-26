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

import type { Network } from '@perawallet/wallet-core-shared'
import type { BaseStoreState } from '@perawallet/wallet-core-shared'

export type DeviceApplication = 'pera' | 'pera-beta' | 'fifa'

export interface DeviceRequest {
    id?: string
    push_token?: string
    platform: DevicePlatform
    application?: DeviceApplication
    model?: string
    locale?: string
    accounts: string[]
}

export interface DeviceResponse {
    id?: string
    push_token?: string
    platform: DevicePlatform
    application?: DeviceApplication
    model?: string
    locale?: string
}

export const DevicePlatforms = {
    ios: 'ios',
    android: 'android',
    web: 'web',
} as const

export type DevicePlatform =
    (typeof DevicePlatforms)[keyof typeof DevicePlatforms]

export interface DeviceInfoService {
    initializeDeviceInfo(): void
    getAppName(): string
    getAppId(): string
    getAppPackage(): string
    getAppBuild(): string
    getAppVersion(): string
    getDeviceID(): Promise<string>
    getDeviceModel(): string
    getDevicePlatform(): DevicePlatform
    getDeviceLocale(): string
    getDeviceCountry(): string
    getUserAgent(): string
}

export type DeviceState = BaseStoreState & {
    pushToken: string | null
    deviceIDs: Map<Network, string | null>
    network: Network
    setPushToken: (token: string | null) => void
    setDeviceID: (network: Network, id: string | null) => void
    setNetwork: (network: Network) => void
}
