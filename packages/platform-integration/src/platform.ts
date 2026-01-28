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
import { DataStoreRegistry } from '@perawallet/wallet-core-shared'
import {
    CrashReportingServiceContainerKey,
    type CrashReportingService,
} from './reporting'
import {
    RemoteConfigServiceContainerKey,
    type RemoteConfigService,
} from './remote-config'
import {
    AnalyticsServiceContainerKey,
    type AnalyticsService,
} from './analytics'
import {
    KeyValueStorageServiceContainerKey,
    SecureStorageServiceContainerKey,
    type KeyValueStorageService,
    type SecureStorageService,
} from './storage'
import {
    BiometricsServiceContainerKey,
    type BiometricsService,
} from './biometrics'
import {
    PushNotificationServiceContainerKey,
    type PushNotificationService,
} from './push-notifications'
import { DeviceInfoServiceContainerKey, type DeviceInfoService } from './device'
import type { PlatformServices } from './models'

export const registerPlatformServices = async (platform: PlatformServices) => {
    // Register platform services in the DI container
    container.register<KeyValueStorageService>(
        KeyValueStorageServiceContainerKey,
        { useValue: platform.keyValueStorage },
    )
    container.register<SecureStorageService>(SecureStorageServiceContainerKey, {
        useValue: platform.secureStorage,
    })
    container.register<RemoteConfigService>(RemoteConfigServiceContainerKey, {
        useValue: platform.remoteConfig,
    })
    container.register<AnalyticsService>(AnalyticsServiceContainerKey, {
        useValue: platform.analytics,
    })
    container.register<PushNotificationService>(
        PushNotificationServiceContainerKey,
        {
            useValue: platform.pushNotification,
        },
    )
    container.register<CrashReportingService>(
        CrashReportingServiceContainerKey,
        {
            useValue: platform.crashReporting,
        },
    )
    container.register<DeviceInfoService>(DeviceInfoServiceContainerKey, {
        useValue: platform.deviceInfo,
    })
    container.register<BiometricsService>(BiometricsServiceContainerKey, {
        useValue: platform.biometrics,
    })

    // Initialize all registered data stores now that platform services are available
    await DataStoreRegistry.initializeAll()
}
