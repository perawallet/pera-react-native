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
import { resetProvider } from '@perawallet/wallet-core-provider'
import { getPlatformServices } from '../get-platform-services'
import { registerTestPlatform } from '../test-utils'
import type { AnalyticsService } from '../analytics'

describe('getPlatformServices', () => {
    afterEach(() => {
        resetProvider()
    })

    it('should throw when provider is not initialized', () => {
        expect(() => getPlatformServices()).toThrow('Provider not initialized.')
    })

    it('should return platform services after provider initialization', () => {
        const mockAnalytics: AnalyticsService = {
            initializeAnalytics: vi.fn(),
            logEvent: vi.fn(),
        }

        registerTestPlatform({ analytics: mockAnalytics })

        const services = getPlatformServices()
        expect(services.analytics).toBe(mockAnalytics)
    })

    it('should return all 8 platform services', () => {
        const platform = registerTestPlatform()

        const services = getPlatformServices()
        expect(services.analytics).toBe(platform.analytics)
        expect(services.keyValueStorage).toBe(platform.keyValueStorage)
        expect(services.secureStorage).toBe(platform.secureStorage)
        expect(services.remoteConfig).toBe(platform.remoteConfig)
        expect(services.pushNotification).toBe(platform.pushNotification)
        expect(services.crashReporting).toBe(platform.crashReporting)
        expect(services.deviceInfo).toBe(platform.deviceInfo)
        expect(services.biometrics).toBe(platform.biometrics)
    })
})
