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

// Test implementation of the platform driver. The production stub throws at
// runtime, expecting the bundler to alias it to a concrete impl; tests need a
// third sibling of real-ish in-memory services that don't require MMKV,
// Keychain or native crypto.
//
// The vitest config aliases the package here, so every
// `getPlatformServices` import resolves to this at test time.
import {
    MemoryKeyValueStorage,
    DevicePlatforms,
    type AnalyticsService,
    type AppIntegrityService,
    type AgeGateService,
    type BiometricsService,
    type CrashReportingService,
    type DatabaseService,
    type DeviceInfoService,
    type KeyValueStorageService,
    type MigrationService,
    type PlatformExtensionFn,
    type PlatformServices,
    type PushNotificationService,
    type RemoteConfigService,
} from '@perawallet/wallet-extension-platform'
import { createHardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import { testDatabaseService } from './sqlite-database'

const buildServices = (): PlatformServices => {
    const keyValueStorage: KeyValueStorageService = new MemoryKeyValueStorage()
    const database: DatabaseService = testDatabaseService

    const ageGate: AgeGateService = {
        async requestAgeRange(_minimumAge) {
            return { status: 'unknown', source: 'platform' }
        },
        async getDeviceCapability() {
            return 'manual'
        },
    }

    const biometrics: BiometricsService = {
        async getSupportedBiometricType() {
            return 'fingerprint'
        },
        async checkBiometricsAvailable() {
            return true
        },
        async getSecurityLevel() {
            return 'strong'
        },
        async authenticate() {
            return true
        },
    }

    const analytics: AnalyticsService = {
        initializeAnalytics() {},
        logEvent() {},
    }

    const crashReporting: CrashReportingService = {
        initializeCrashReporting() {},
        recordNonFatalError() {},
    }

    const remoteConfig: RemoteConfigService = {
        initializeRemoteConfig() {},
        getStringValue: (_key, fallback) => fallback ?? '',
        getBooleanValue: (_key, fallback) => fallback ?? false,
        getNumberValue: (_key, fallback) => fallback ?? 0,
    }

    const pushNotification: PushNotificationService = {
        isSupported: () => true,
        async initializeNotifications() {
            return { unsubscribe: () => {} }
        },
        async getPushToken() {
            return undefined
        },
        addTokenRefreshListener() {
            return () => {}
        },
        addNotificationOpenListener() {
            return () => {}
        },
    }

    const deviceInfo: DeviceInfoService = {
        getAppName: () => 'Pera Wallet (Test)',
        getAppId: () => 'com.test.perawallet',
        getAppPackage: () => 'com.test.perawallet',
        getAppBuild: () => '1',
        getAppVersion: () => '0.0.0-test',
        getDeviceID: async () => 'test-device-id',
        getDeviceModel: () => 'TestDevice',
        getDevicePlatform: () => DevicePlatforms.web,
        getDeviceOSVersion: () => '0',
        getDeviceLocale: () => 'en-US',
        getDeviceCountry: () => 'US',
        getDeviceModelId: () => 'test-model-id',
        getUserAgent: () => 'Pera/test',
        // Non-store env so the startup attestation handshake is skipped in tests.
        getAppEnvironment: () => 'development',
        isStoreBuild: () => false,
    }

    const appIntegrity: AppIntegrityService = {
        isSupported: async () => false,
        attest: async () => ({
            attestation: 'test-attestation',
            keyId: 'test-key-id',
        }),
    }

    const migration: MigrationService = {
        hasLegacyData: async () => false,
        getLegacyData: async () => {
            throw new Error(
                'migration.getLegacyData not implemented in test driver',
            )
        },
        isMigrationComplete: async () => true,
        markMigrationComplete: async () => {},
        clearMigrationComplete: async () => {},
        getMigrationPlans: async () => [],
        simulateLegacyDatabase: async () => {},
        simulatePreSixxAccounts: async () => {},
        resetLegacyData: async () => {},
        getCompletedStepVersions: async () => null,
        setCompletedStepVersions: async () => {},
    }

    return {
        analytics,
        ageGate,
        biometrics,
        crashReporting,
        pushNotification,
        remoteConfig,
        keyValueStorage,
        database,
        deviceInfo,
        appIntegrity,
        hardwareWalletRegistry: createHardwareWalletRegistry(),
        migration,
    }
}

let cached: PlatformServices | null = null

const getServices = (): PlatformServices => {
    if (!cached) cached = buildServices()
    return cached
}

export const WithPlatformExtension: PlatformExtensionFn = _provider => {
    const services = getServices()
    return {
        ...services,
        initialize: async () => ({ unsubscribe: () => {} }),
    }
}

export const getPlatformServices = (): PlatformServices => getServices()

// Test helper: reset the cached services. Call from `afterEach` if a test
// mutates KV storage and you want a clean slate.
export const resetTestPlatform = (): void => {
    cached = null
}

export type {
    PlatformExtension,
    PlatformExtensionFn,
    PlatformServices,
} from '@perawallet/wallet-extension-platform'
