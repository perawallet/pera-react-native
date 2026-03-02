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

import type { PeraProvider } from '@perawallet/wallet-core-provider'
import type { PlatformServices } from './models'
import { initDeviceStore } from './device/store'
import { initRemoteConfigStore } from './remote-config/store'

export interface PlatformExtensionOptions {
    platform: PlatformServices
}

export type PlatformServicesExtension = PlatformServices

/**
 * The provider type after the WithPlatformServices extension has been applied.
 * Use with `getProvider<PeraProviderWithPlatform>()` to access platform services.
 */
export type PeraProviderWithPlatform = PeraProvider & PlatformServicesExtension

/**
 * wallet-provider Extension that makes all platform services available
 * on the provider instance and synchronously initializes the DeviceStore
 * and RemoteConfigStore.
 */
export const WithPlatformServices = (
    _provider: unknown,
    options: PlatformExtensionOptions,
): PlatformServicesExtension => {
    const { platform } = options

    // Initialize stores synchronously during provider construction
    initDeviceStore(platform.keyValueStorage)
    initRemoteConfigStore(platform.keyValueStorage)

    return {
        keyValueStorage: platform.keyValueStorage,
        secureStorage: platform.secureStorage,
        biometrics: platform.biometrics,
        pushNotification: platform.pushNotification,
        remoteConfig: platform.remoteConfig,
        analytics: platform.analytics,
        crashReporting: platform.crashReporting,
        deviceInfo: platform.deviceInfo,
    }
}
