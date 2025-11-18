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
import {
    CrashReportingServiceContainerKey,
    type CrashReportingService,
} from '../services/reporting'
import {
    RemoteConfigServiceContainerKey,
    type RemoteConfigService,
} from '../services/remote-config'
import {
    AnalyticsServiceContainerKey,
    type AnalyticsService,
} from '../services/analytics'
import {
    KeyValueStorageServiceContainerKey,
    SecureStorageServiceContainerKey,
    type KeyValueStorageService,
    type SecureStorageService,
} from '../services'
import {
    NotificationServiceContainerKey,
    type NotificationService,
} from '../services/notifications'
import {
    DeviceInfoServiceContainerKey,
    type DeviceInfoService,
} from '../services/device/platform-service'
import { reinitializeAppStore } from '../store/app-store'

export interface PlatformServices {
    keyValueStorage: KeyValueStorageService
    secureStorage: SecureStorageService
    notification: NotificationService
    remoteConfig: RemoteConfigService
    analytics: AnalyticsService
    crashReporting: CrashReportingService
    deviceInfo: DeviceInfoService
}

export const registerPlatformServices = (platform: PlatformServices) => {
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
    container.register<NotificationService>(NotificationServiceContainerKey, {
        useValue: platform.notification,
    })
    container.register<CrashReportingService>(
        CrashReportingServiceContainerKey,
        {
            useValue: platform.crashReporting,
        },
    )
    container.register<DeviceInfoService>(DeviceInfoServiceContainerKey, {
        useValue: platform.deviceInfo,
    })
    reinitializeAppStore()
}
