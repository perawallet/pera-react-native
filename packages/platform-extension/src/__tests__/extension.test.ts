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

import { describe, expect, it, vi } from 'vitest'
import { WithPlatformServicesExtension } from '../extension'
import type { PlatformServices } from '../models'
import type { AnalyticsService } from '../analytics'
import type { CrashReportingService } from '../reporting'
import type { RemoteConfigService } from '../remote-config'
import type { KeyValueStorageService, SecureStorageService } from '../storage'
import type { PushNotificationService } from '../push-notifications'
import type { DeviceInfoService } from '../device'
import type { BiometricsService } from '../biometrics'
import { MemoryKeyValueStorage } from '../test-utils'

describe('WithPlatformServicesExtension extension', () => {
    const createMockPlatform = (): PlatformServices => ({
        analytics: {
            initializeAnalytics: vi.fn(),
            logEvent: vi.fn(),
        } as AnalyticsService,
        keyValueStorage:
            new MemoryKeyValueStorage() as unknown as KeyValueStorageService,
        secureStorage: {
            setItem: vi.fn(),
            getItem: vi.fn(),
            removeItem: vi.fn(),
            authenticate: vi.fn(),
        } as SecureStorageService,
        remoteConfig: {
            initializeRemoteConfig: vi.fn(),
            getStringValue: vi.fn(),
            getBooleanValue: vi.fn(),
            getNumberValue: vi.fn(),
        } as RemoteConfigService,
        pushNotification: {
            initializeNotifications: vi.fn(),
        } as PushNotificationService,
        crashReporting: {
            initializeCrashReporting: vi.fn(),
            recordNonFatalError: vi.fn(),
        } as CrashReportingService,
        deviceInfo: {
            initializeDeviceInfo: vi.fn(),
            getDeviceID: vi.fn(),
            getDeviceModel: vi.fn(),
            getDevicePlatform: vi.fn(),
            getDeviceLocale: vi.fn(),
            getDeviceCountry: vi.fn(),
            getUserAgent: vi.fn(),
            getAppVersion: vi.fn(),
            getAppBuild: vi.fn(),
            getAppName: vi.fn(),
            getAppId: vi.fn(),
            getAppPackage: vi.fn(),
        } as DeviceInfoService,
        biometrics: {
            getSupportedBiometricType: vi.fn(),
            checkBiometricsAvailable: vi.fn(),
            authenticate: vi.fn(),
        } as BiometricsService,
    })

    it('should return all platform services', () => {
        const platform = createMockPlatform()
        const result = WithPlatformServicesExtension({}, { platform })

        expect(result.analytics).toBe(platform.analytics)
        expect(result.keyValueStorage).toBe(platform.keyValueStorage)
        expect(result.secureStorage).toBe(platform.secureStorage)
        expect(result.remoteConfig).toBe(platform.remoteConfig)
        expect(result.pushNotification).toBe(platform.pushNotification)
        expect(result.crashReporting).toBe(platform.crashReporting)
        expect(result.deviceInfo).toBe(platform.deviceInfo)
        expect(result.biometrics).toBe(platform.biometrics)
    })

    it('should initialize device and remote config stores', () => {
        const platform = createMockPlatform()

        // Should not throw — stores are initialized during extension construction
        expect(() =>
            WithPlatformServicesExtension({}, { platform }),
        ).not.toThrow()
    })
})
