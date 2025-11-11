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

import { container } from 'tsyringe'
import type { DevicePlatform } from './types'

export const DeviceInfoServiceContainerKey = 'DeviceInfoService'

export interface DeviceInfoService {
    initializeDeviceInfo(): void
    getDeviceID(): Promise<string>
    getDeviceModel(): string
    getDevicePlatform(): DevicePlatform
    getDeviceLocale(): string
    getUserAgent(): string
    getAppVersion(): string
}

export const useDeviceInfoService = () =>
    container.resolve<DeviceInfoService>(DeviceInfoServiceContainerKey)
