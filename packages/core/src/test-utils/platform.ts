import {
    registerPlatformServices,
    type PlatformServices,
} from '@platform/index'
import { MemoryKeyValueStorage } from './storage'
import type {
    KeyValueStorageService,
    SecureStorageService,
} from '../services/storage'
import type { RemoteConfigService } from '../services/remote-config'
import type { NotificationService } from '../services/notifications'
import type { CrashReportingService } from '../services/reporting'
import { DevicePlatforms, type DeviceInfoService } from '@services/device'

type Overrides = Partial<{
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
    const defaultSecure: SecureStorageService = {
        async setItem(_k: string, _v: string) {},
        async getItem(_k: string) {
            return null
        },
        async removeItem(_k: string) {},
        async authenticate() {
            return true
        },
    }

    const defaultRemote: RemoteConfigService = {
        initializeRemoteConfig() {},
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
            return { unsubscribe: () => {} }
        },
    }

    const defaultCrash: CrashReportingService = {
        initializeCrashReporting() {},
        recordNonFatalError(_e: unknown) {},
    }

    const deviceInfo: DeviceInfoService = {
        initializeDeviceInfo() {},
        getDeviceID() {
            return Promise.resolve('testID')
        },
        getDeviceModel() {
            return 'testModel'
        },
        getDevicePlatform() {
            return Promise.resolve(DevicePlatforms.web)
        },
        getDeviceLocale() {
            return 'testLocale'
        },
    }

    return {
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
