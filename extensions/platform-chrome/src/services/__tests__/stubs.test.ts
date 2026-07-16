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

import { describe, expect, it } from 'vitest'
import {
    ChromeAgeGateService,
    ChromeAppIntegrityService,
    ChromeBiometricsService,
    ChromeMigrationService,
    ChromePushNotificationService,
    ChromeRemoteConfigService,
} from '../stubs'

describe('ChromeRemoteConfigService', () => {
    const service = new ChromeRemoteConfigService()

    it('serves bundled defaults', () => {
        expect(service.getNumberValue('fee_min_txn_fee')).toBe(1000)
        expect(service.getBooleanValue('enable_pera_card')).toBe(false)
        expect(service.getStringValue('terms_version')).toBe('1')
    })

    it('falls back for unknown keys', () => {
        expect(service.getStringValue('nope', 'fb')).toBe('fb')
        expect(service.getBooleanValue('nope', true)).toBe(true)
        expect(service.getNumberValue('nope', 7)).toBe(7)
    })
})

describe('capability stubs', () => {
    it('reports unsupported/none capabilities', async () => {
        await expect(
            new ChromeAppIntegrityService().isSupported(),
        ).resolves.toBe(false)
        await expect(
            new ChromeBiometricsService().getSecurityLevel(),
        ).resolves.toBe('none')
        await expect(
            new ChromeAgeGateService().requestAgeRange(18),
        ).resolves.toEqual({ status: 'unknown', source: 'self-declared' })
        await expect(
            new ChromeMigrationService().hasLegacyData(),
        ).resolves.toBe(false)
    })

    it('push notifications resolve with no token and an unsubscribe fn', async () => {
        const result =
            await new ChromePushNotificationService().initializeNotifications()
        expect(result.token).toBeUndefined()
        expect(() => result.unsubscribe()).not.toThrow()
    })

    it('reports push notifications as unsupported', () => {
        expect(new ChromePushNotificationService().isSupported()).toBe(false)
    })
})
