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

import { Provider } from '@algorandfoundation/wallet-provider'
import {
    type AgeGateService,
    type AnalyticsService,
    type AppIntegrityService,
    type BiometricsService,
    type CrashReportingService,
    createStubMigrationService,
    type DatabaseService,
    type DeviceInfoService,
    DevicePlatforms,
    type KeyValueStorageService,
    MemoryDatabaseService,
    MemoryKeyValueStorage,
    type MigrationService,
    type PlatformServices,
    type PushNotificationService,
    type RemoteConfigService,
} from '@perawallet/wallet-extension-platform'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import { createHardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import { initializeProvider, resetProvider } from './singleton'
import { type PeraProvider } from './pera-provider'

export type TestPlatformOverrides = Partial<{
    analytics: AnalyticsService
    appIntegrity: AppIntegrityService
    keyValueStorage: KeyValueStorageService
    biometrics: BiometricsService
    ageGate: AgeGateService
    remoteConfig: RemoteConfigService
    pushNotification: PushNotificationService
    crashReporting: CrashReportingService
    database: DatabaseService
    deviceInfo: DeviceInfoService
    hardwareWalletRegistry: HardwareWalletRegistry
    migration: MigrationService
}>

/**
 * Build a complete PlatformServices bundle with sensible no-op defaults suitable for tests.
 * Individual services can be overridden as needed per test.
 */
export const buildTestPlatform = (
    overrides: TestPlatformOverrides = {},
): PlatformServices => {
    const defaultAnalytics: AnalyticsService = {
        initializeAnalytics() {},
        logEvent(_event: string, _properties?: Record<string, unknown>) {},
    }

    const defaultRemote: RemoteConfigService = {
        async initializeRemoteConfig() {},
        getStringValue(_, f) {
            return f ?? ''
        },
        getBooleanValue(_, f) {
            return f ?? false
        },
        getNumberValue(_, f) {
            return f ?? 0
        },
    }

    const defaultPushNotification: PushNotificationService = {
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

    const defaultCrash: CrashReportingService = {
        initializeCrashReporting() {},
        recordNonFatalError(_: unknown) {},
    }

    const deviceInfo: DeviceInfoService = {
        getDeviceInstallationID() {
            return Promise.resolve('testID')
        },
        getDeviceModel() {
            return 'testModel'
        },
        getDevicePlatform() {
            return DevicePlatforms.web
        },
        getDeviceLocale() {
            return 'testLocale'
        },
        getDeviceLocales() {
            return ['testLocale']
        },
        getAppVersion() {
            return 'testVersion'
        },
        getUserAgent() {
            return 'testUserAgent'
        },
        getAppId() {
            return 'testAppId'
        },
        getAppPackage() {
            return 'testPackage'
        },
        getAppBuild() {
            return 'testBuild'
        },
        getAppName() {
            return 'testAppName'
        },
        getDeviceCountry() {
            return 'testCountry'
        },
        getDeviceModelId() {
            return 'testModelId'
        },
        getDeviceOSVersion() {
            return 'testOsVersion'
        },
        getAppEnvironment() {
            return 'production'
        },
        isStoreBuild() {
            return true
        },
    }

    const defaultBiometrics: BiometricsService = {
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

    const defaultAppIntegrity: AppIntegrityService = {
        async isSupported() {
            return true
        },
        async attest() {
            return { attestation: 'test-attestation', keyId: 'test-key-id' }
        },
    }

    const defaultHardwareWalletRegistry = createHardwareWalletRegistry()
    defaultHardwareWalletRegistry.register({
        manufacturer: 'ledger',
        transportType: 'ble',
        scan: () => () => {},
        connect: async () => ({
            getAddress: async (accountIndex: number) => ({
                address: `TEST_ADDR_${accountIndex}`,
                publicKey: new Uint8Array(32),
                accountIndex,
            }),
            signTransaction: async () => new Uint8Array(64),
            signData: async () => new Uint8Array(64),
            getAppVersion: async () => ({ major: 0, minor: 0, patch: 0 }),
            disconnect: async () => {},
        }),
        isSupported: async () => false,
    })

    return {
        analytics: overrides.analytics ?? defaultAnalytics,
        keyValueStorage:
            overrides.keyValueStorage ?? new MemoryKeyValueStorage(),
        biometrics: overrides.biometrics ?? defaultBiometrics,
        ageGate: overrides.ageGate ?? {
            requestAgeRange: async () => ({
                status: 'unknown',
                source: 'platform',
            }),
            getDeviceCapability: async () => 'manual',
        },
        remoteConfig: overrides.remoteConfig ?? defaultRemote,
        pushNotification: overrides.pushNotification ?? defaultPushNotification,
        crashReporting: overrides.crashReporting ?? defaultCrash,
        database: overrides.database ?? new MemoryDatabaseService(),
        deviceInfo: overrides.deviceInfo ?? deviceInfo,
        appIntegrity: overrides.appIntegrity ?? defaultAppIntegrity,
        hardwareWalletRegistry:
            overrides.hardwareWalletRegistry ?? defaultHardwareWalletRegistry,
        migration: overrides.migration ?? createStubMigrationService(),
    }
}

/**
 * Register a test platform by creating a provider with the given services.
 * Resets any existing provider first for test isolation.
 * Returns the PlatformServices used for registration for further assertions.
 */
export const registerTestPlatform = (
    overrides: TestPlatformOverrides = {},
): PlatformServices => {
    resetProvider()
    const platform = buildTestPlatform(overrides)
    const WithTestPlatformExtension = (_provider: unknown) => ({
        ...platform,
    })
    const TestProvider = Provider.withExtensions([
        WithTestPlatformExtension,
    ] as const)
    const provider = new TestProvider({ id: 'test', name: 'Test Provider' })
    initializeProvider(provider as PeraProvider)
    return platform
}
