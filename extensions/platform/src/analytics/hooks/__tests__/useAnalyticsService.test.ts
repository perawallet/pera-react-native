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

import { describe, test, expect, vi } from 'vitest'
import { registerTestPlatform } from '../../../test-utils'
import { useAnalyticsService } from '../..'
import type { AnalyticsService } from '../..'

describe('services/analytics/hooks', () => {
    test('useAnalyticsService resolves the analytics service from the provider and forwards logEvent', () => {
        const dummy: AnalyticsService = {
            initializeAnalytics: vi.fn(),
            logEvent: vi.fn(),
        }

        registerTestPlatform({ analytics: dummy })

        const svc = useAnalyticsService()
        expect(svc).toBe(dummy)

        svc.logEvent('test_event', { foo: 'bar' })
        expect(dummy.logEvent).toHaveBeenCalledWith('test_event', {
            foo: 'bar',
        })
    })
})
