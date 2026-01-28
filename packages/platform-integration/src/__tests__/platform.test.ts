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

import { container } from 'tsyringe'
import { registerPlatformServices } from '../platform'
import {
    AnalyticsServiceContainerKey,
    type AnalyticsService,
} from '../analytics'
import {
    CrashReportingServiceContainerKey,
    type CrashReportingService,
} from '../reporting'
import {
    RemoteConfigServiceContainerKey,
    type RemoteConfigService,
} from '../remote-config'
import {
    KeyValueStorageServiceContainerKey,
    SecureStorageServiceContainerKey,
    type KeyValueStorageService,
    type SecureStorageService,
} from '../storage'
import {
    PushNotificationServiceContainerKey,
    type PushNotificationService,
} from '../push-notifications'
import {
    DeviceInfoServiceContainerKey,
    type DeviceInfoService,
} from '../device'
import type { PlatformServices } from '../models'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BiometricsService, BiometricsServiceContainerKey } from '../biometrics'

vi.mock('tsyringe', () => ({
    container: {
        register: vi.fn(),
    },
}))

describe('platform', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('should register all platform services', async () => {
        const mockAnalytics = {} as AnalyticsService
        const mockKeyValueStorage = {} as KeyValueStorageService
        const mockSecureStorage = {} as SecureStorageService
        const mockRemoteConfig = {} as RemoteConfigService
        const mockNotification = {} as PushNotificationService
        const mockCrashReporting = {} as CrashReportingService
        const mockDeviceInfo = {} as DeviceInfoService
        const mockBiometrics = {} as BiometricsService

        const mockPlatform: PlatformServices = {
            analytics: mockAnalytics,
            keyValueStorage: mockKeyValueStorage,
            secureStorage: mockSecureStorage,
            remoteConfig: mockRemoteConfig,
            pushNotification: mockNotification,
            crashReporting: mockCrashReporting,
            deviceInfo: mockDeviceInfo,
            biometrics: mockBiometrics,
        }

        await registerPlatformServices(mockPlatform)

        expect(container.register).toHaveBeenCalledWith(
            KeyValueStorageServiceContainerKey,
            { useValue: mockKeyValueStorage },
        )
        expect(container.register).toHaveBeenCalledWith(
            SecureStorageServiceContainerKey,
            { useValue: mockSecureStorage },
        )
        expect(container.register).toHaveBeenCalledWith(
            RemoteConfigServiceContainerKey,
            { useValue: mockRemoteConfig },
        )
        expect(container.register).toHaveBeenCalledWith(
            AnalyticsServiceContainerKey,
            { useValue: mockAnalytics },
        )
        expect(container.register).toHaveBeenCalledWith(
            PushNotificationServiceContainerKey,
            { useValue: mockNotification },
        )
        expect(container.register).toHaveBeenCalledWith(
            CrashReportingServiceContainerKey,
            { useValue: mockCrashReporting },
        )
        expect(container.register).toHaveBeenCalledWith(
            DeviceInfoServiceContainerKey,
            { useValue: mockDeviceInfo },
        )
        expect(container.register).toHaveBeenCalledWith(
            BiometricsServiceContainerKey,
            { useValue: mockBiometrics },
        )
    })
})
