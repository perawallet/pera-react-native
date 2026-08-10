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

import type { PlatformServices } from '@perawallet/wallet-extension-platform'
import { createHardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import {
    RNAgeGateService,
    RNAppIntegrityService,
    RNDatabaseService,
    RNKeyValueStorageService,
    RNFirebaseService,
    RNBiometricsService,
    RNMigrationService,
    RNDeviceInfoStorageService,
    RNWalletProvisioningService,
} from './services'

/**
 * Module-level singletons for all React Native platform services.
 *
 * All constructors are synchronous (MMKV via JSI, native module wrappers),
 * so they are safe to create at module scope. Async initialization
 * (Firebase, push notifications) happens separately via `initialize()`.
 */
const keyValueStorage = new RNKeyValueStorageService()
const firebaseService = new RNFirebaseService()

const hardwareWalletRegistry = createHardwareWalletRegistry()

export const platformServices: PlatformServices = {
    analytics: firebaseService,
    biometrics: new RNBiometricsService(),
    ageGate: new RNAgeGateService(),
    crashReporting: firebaseService,
    pushNotification: firebaseService,
    remoteConfig: firebaseService,
    keyValueStorage,
    database: new RNDatabaseService(),
    deviceInfo: new RNDeviceInfoStorageService(),
    appIntegrity: new RNAppIntegrityService(),
    hardwareWalletRegistry,
    migration: new RNMigrationService(keyValueStorage),
    walletProvisioning: new RNWalletProvisioningService(),
}

export const getPlatformServices = (): PlatformServices => platformServices

/** No-op on native: MMKV storage is synchronous from construction. */
export const hydratePlatform = async (): Promise<void> => {}
