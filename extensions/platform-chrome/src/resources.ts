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

import type { PlatformServices } from '@perawallet/wallet-extension-platform'
import { createHardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import {
    ChromeAgeGateService,
    ChromeAnalyticsService,
    ChromeAppIntegrityService,
    ChromeBiometricsService,
    ChromeCrashReportingService,
    ChromeDatabaseService,
    ChromeDeviceInfoService,
    ChromeMigrationService,
    ChromePushNotificationService,
    ChromeRemoteConfigService,
    ChromeWalletProvisioningService,
} from './services'
import { keyValueStorage } from './key-value-singleton'

export { hydratePlatform } from './key-value-singleton'

export const platformServices: PlatformServices = {
    analytics: new ChromeAnalyticsService(),
    biometrics: new ChromeBiometricsService(),
    ageGate: new ChromeAgeGateService(),
    crashReporting: new ChromeCrashReportingService(),
    pushNotification: new ChromePushNotificationService(),
    remoteConfig: new ChromeRemoteConfigService(),
    keyValueStorage,
    database: new ChromeDatabaseService(),
    deviceInfo: new ChromeDeviceInfoService(),
    appIntegrity: new ChromeAppIntegrityService(),
    hardwareWalletRegistry: createHardwareWalletRegistry(),
    migration: new ChromeMigrationService(),
    walletProvisioning: new ChromeWalletProvisioningService(),
}

export const getPlatformServices = (): PlatformServices => platformServices
