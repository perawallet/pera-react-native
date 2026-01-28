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

import type { AnalyticsService } from './analytics'
import type { BiometricsService } from './biometrics'
import type { DeviceInfoService } from './device'
import type { PushNotificationService } from './push-notifications'
import type { RemoteConfigService } from './remote-config'
import type { CrashReportingService } from './reporting'
import type { KeyValueStorageService, SecureStorageService } from './storage'

export interface PlatformServices {
    keyValueStorage: KeyValueStorageService
    secureStorage: SecureStorageService
    biometrics: BiometricsService
    pushNotification: PushNotificationService
    remoteConfig: RemoteConfigService
    analytics: AnalyticsService
    crashReporting: CrashReportingService
    deviceInfo: DeviceInfoService
}
