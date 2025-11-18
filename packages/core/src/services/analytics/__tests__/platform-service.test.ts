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

import { describe, test, expect, vi, afterEach } from 'vitest'
import { container } from 'tsyringe'
import {
    AnalyticsServiceContainerKey,
    useAnalyticsService,
} from '@services/analytics'
import type { AnalyticsService } from '@services/analytics'
import {
    RemoteConfigServiceContainerKey,
    useRemoteConfigService,
    type RemoteConfigService,
} from '@services/remote-config'

describe('services/remote-config/platform-service', () => {
    afterEach(() => {
        container.reset()
    })

    test('useRemoteConfigService resolves the registered RemoteConfigService from the container', () => {
        const dummy: RemoteConfigService = {
            initializeRemoteConfig: vi.fn(),
            getStringValue: vi.fn(() => 'value'),
            getBooleanValue: vi.fn(() => true),
            getNumberValue: vi.fn(() => 42),
        }

        container.register(RemoteConfigServiceContainerKey, { useValue: dummy })

        const svc = useRemoteConfigService()
        expect(svc).toBe(dummy)

        svc.initializeRemoteConfig()
        expect(dummy.initializeRemoteConfig).toHaveBeenCalledTimes(1)
    })
})

describe('services/analytics/platform-service', () => {
    afterEach(() => {
        container.reset()
    })

    test('useAnalyticsService resolves the registered AnalyticsService from the container and forwards logEvent', () => {
        const dummy: AnalyticsService = {
            initializeAnalytics: vi.fn(),
            logEvent: vi.fn(),
        }

        container.register(AnalyticsServiceContainerKey, { useValue: dummy })

        const svc = useAnalyticsService()
        expect(svc).toBe(dummy)

        svc.logEvent('test_event', { foo: 'bar' })
        expect(dummy.logEvent).toHaveBeenCalledWith('test_event', {
            foo: 'bar',
        })
    })
})
