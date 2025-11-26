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

import {
    registerPlatformServices,
    MemoryKeyValueStorage,
    type PlatformServices,
    KeyValueStorageService,
    SecureStorageService,
    RemoteConfigService,
    NotificationService,
    CrashReportingService,
    DeviceInfoService,
    DevicePlatforms,
    AnalyticsService,
} from '../index'

type Overrides = Partial<{
    analytics: AnalyticsService
    keyValueStorage: KeyValueStorageService
    secureStorage: SecureStorageService
    remoteConfig: RemoteConfigService
    notification: NotificationService
    crashReporting: CrashReportingService
    deviceInfo: DeviceInfoService
}>

/**
 * Build a complete PlatformServices bundle with sensible no-op defaults suitable for tests.
 * Individual services can be overridden as needed per test.
 */
export const buildTestPlatform = (
    overrides: Overrides = {},
): PlatformServices => {
    const defaultAnalytics: AnalyticsService = {
        initializeAnalytics() { },
        logEvent(_event: string, _properties?: Record<string, unknown>) { },
    }

    const defaultSecure: SecureStorageService = {
        async setItem(_k: string, _v: Buffer) { },
        async getItem(_k: string) {
            return null
        },
        async removeItem(_k: string) { },
        async authenticate() {
            return true
        },
    }

    const defaultRemote: RemoteConfigService = {
        initializeRemoteConfig() { },
        getStringValue(_k, f) {
            return f ?? ''
        },
        getBooleanValue(_k, f) {
            return f ?? false
        },
        getNumberValue(_k, f) {
            return f ?? 0
        },
    }

    const defaultNotification: NotificationService = {
        async initializeNotifications() {
            return { unsubscribe: () => { } }
        },
    }

    const defaultCrash: CrashReportingService = {
        initializeCrashReporting() { },
        recordNonFatalError(_e: unknown) { },
    }

    const deviceInfo: DeviceInfoService = {
        initializeDeviceInfo() { },
        getDeviceID() {
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
        getAppVersion() {
            return 'testVersion'
        },
        getUserAgent() {
            return 'testUserAgent'
        },
    }

    return {
        analytics: overrides.analytics ?? defaultAnalytics,
        keyValueStorage:
            overrides.keyValueStorage ?? new MemoryKeyValueStorage(),
        secureStorage: overrides.secureStorage ?? defaultSecure,
        remoteConfig: overrides.remoteConfig ?? defaultRemote,
        notification: overrides.notification ?? defaultNotification,
        crashReporting: overrides.crashReporting ?? defaultCrash,
        deviceInfo: overrides.deviceInfo ?? deviceInfo,
    }
}

/**
 * Register a test platform in the tsyringe container using registerPlatformServices.
 * Returns the PlatformServices used for registration for further assertions.
 */
export const registerTestPlatform = (
    overrides: Overrides = {},
): PlatformServices => {
    const platform = buildTestPlatform(overrides)
    registerPlatformServices(platform)
    return platform
}
