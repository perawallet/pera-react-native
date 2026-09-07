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

import type { AppIntegrityService } from './app-integrity'
import type { AgeGateService } from './age-gate'
import type { AnalyticsService } from './analytics'
import type { BiometricsService } from './biometrics'
import type { DeviceInfoService } from './device'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import type { MigrationService } from './migration'
import type {
    PushNotificationInitResult,
    PushNotificationService,
} from './push-notifications'
import type { RemoteConfigService } from './remote-config'
import type { DatabaseService } from './database'
import type { CrashReportingService } from './reporting'
import type { KeyValueStorageService } from './storage'
import type { WalletProvisioningService } from './wallet-provisioning'

export interface PlatformServices {
    keyValueStorage: KeyValueStorageService
    biometrics: BiometricsService
    ageGate: AgeGateService
    pushNotification: PushNotificationService
    remoteConfig: RemoteConfigService
    analytics: AnalyticsService
    crashReporting: CrashReportingService
    deviceInfo: DeviceInfoService
    appIntegrity: AppIntegrityService
    database: DatabaseService
    hardwareWalletRegistry: HardwareWalletRegistry
    migration: MigrationService
    walletProvisioning: WalletProvisioningService
}

/**
 * What `initialize()` resolves with once the startup-critical services are up.
 *
 * `notifications` is deliberately a promise, not an awaited value: push
 * registration talks to FCM/APNs and is bounded at several seconds, so awaiting
 * it inside `initialize` kept the splash up for the whole round trip on a slow
 * or offline network. Callers await `initialize` for the ordered
 * init they depend on, then consume the token whenever it lands. It never
 * rejects — a failed or timed-out registration resolves with no token.
 */
export type PlatformInitResult = {
    notifications: Promise<PushNotificationInitResult>
}

export type PlatformExtension = PlatformServices & {
    initialize: () => Promise<PlatformInitResult>
}

export type PlatformExtensionFn = (provider: unknown) => PlatformExtension
