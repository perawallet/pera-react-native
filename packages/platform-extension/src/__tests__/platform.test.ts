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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetProvider, getProvider } from '@perawallet/wallet-core-provider'
import { registerPlatformServices } from '../platform'
import type { PeraProviderWithPlatform } from '../extension'
import type { AnalyticsService } from '../analytics'
import type { CrashReportingService } from '../reporting'
import type { RemoteConfigService } from '../remote-config'
import type { KeyValueStorageService, SecureStorageService } from '../storage'
import type { PushNotificationService } from '../push-notifications'
import type { DeviceInfoService } from '../device'
import type { BiometricsService } from '../biometrics'
import type { PlatformServices } from '../models'
import { MemoryKeyValueStorage } from '../test-utils'

describe('platform', () => {
    afterEach(() => {
        resetProvider()
    })

    it('should register all platform services and make them accessible via getProvider', () => {
        const mockAnalytics: AnalyticsService = {
            initializeAnalytics: vi.fn(),
            logEvent: vi.fn(),
        }
        const mockKeyValueStorage = new MemoryKeyValueStorage()
        const mockSecureStorage: SecureStorageService = {
            setItem: vi.fn(),
            getItem: vi.fn(),
            removeItem: vi.fn(),
            authenticate: vi.fn(),
        }
        const mockRemoteConfig: RemoteConfigService = {
            initializeRemoteConfig: vi.fn(),
            getStringValue: vi.fn(),
            getBooleanValue: vi.fn(),
            getNumberValue: vi.fn(),
        }
        const mockNotification: PushNotificationService = {
            initializeNotifications: vi.fn(),
        }
        const mockCrashReporting: CrashReportingService = {
            initializeCrashReporting: vi.fn(),
            recordNonFatalError: vi.fn(),
        }
        const mockDeviceInfo = {
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
        } as DeviceInfoService
        const mockBiometrics: BiometricsService = {
            getSupportedBiometricType: vi.fn(),
            checkBiometricsAvailable: vi.fn(),
            authenticate: vi.fn(),
        }

        const mockPlatform: PlatformServices = {
            analytics: mockAnalytics,
            keyValueStorage:
                mockKeyValueStorage as unknown as KeyValueStorageService,
            secureStorage: mockSecureStorage,
            remoteConfig: mockRemoteConfig,
            pushNotification: mockNotification,
            crashReporting: mockCrashReporting,
            deviceInfo: mockDeviceInfo,
            biometrics: mockBiometrics,
        }

        registerPlatformServices(mockPlatform)

        // Provider singleton should be set
        expect(() => getProvider()).not.toThrow()

        // All services should be accessible via getProvider
        const provider = getProvider<PeraProviderWithPlatform>()
        expect(provider.analytics).toBe(mockAnalytics)
        expect(provider.keyValueStorage).toBe(mockKeyValueStorage)
        expect(provider.secureStorage).toBe(mockSecureStorage)
        expect(provider.remoteConfig).toBe(mockRemoteConfig)
        expect(provider.pushNotification).toBe(mockNotification)
        expect(provider.crashReporting).toBe(mockCrashReporting)
        expect(provider.deviceInfo).toBe(mockDeviceInfo)
        expect(provider.biometrics).toBe(mockBiometrics)
    })

    it('should throw when called twice without reset', () => {
        const mockPlatform: PlatformServices = {
            analytics: {} as AnalyticsService,
            keyValueStorage:
                new MemoryKeyValueStorage() as unknown as KeyValueStorageService,
            secureStorage: {} as SecureStorageService,
            remoteConfig: {} as RemoteConfigService,
            pushNotification: {} as PushNotificationService,
            crashReporting: {} as CrashReportingService,
            deviceInfo: {} as DeviceInfoService,
            biometrics: {} as BiometricsService,
        }

        registerPlatformServices(mockPlatform)

        expect(() => registerPlatformServices(mockPlatform)).toThrow(
            'Provider already initialized.',
        )
    })
})
