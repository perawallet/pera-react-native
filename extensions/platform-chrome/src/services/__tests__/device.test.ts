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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'

const configMock = vi.hoisted(() => ({ config: { appBuildNumber: '' } }))
vi.mock('@perawallet/wallet-core-config', () => configMock)

import { ChromeDeviceInfoService } from '../device'
import { resetBrowserCache } from '../browser'

const CHROME_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.6422.112 Safari/537.36'

describe('ChromeDeviceInfoService', () => {
    let fake: ChromeFake
    let service: ChromeDeviceInfoService

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
        service = new ChromeDeviceInfoService()
        configMock.config.appBuildNumber = ''
        resetBrowserCache()
        vi.stubGlobal('navigator', {
            userAgent: CHROME_UA,
            language: 'en-US',
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        resetBrowserCache()
    })

    it('reads app identity from the manifest and runtime', () => {
        expect(service.getAppName()).toBe('Pera Wallet')
        expect(service.getAppVersion()).toBe('0.1.0')
        expect(service.getAppId()).toBe('test-extension-id')
        expect(service.getAppPackage()).toBe('test-extension-id')
    })

    it('reports the web platform', () => {
        expect(service.getDevicePlatform()).toBe('web')
    })

    it('falls back to the manifest version for app build when no CI number is set', () => {
        expect(service.getAppBuild()).toBe('0.1.0')
    })

    it('uses the CI build number for app build when present', () => {
        configMock.config.appBuildNumber = '1234'
        expect(service.getAppBuild()).toBe('1234')
    })

    it('reports the host browser name and version as device model/modelId', () => {
        expect(service.getDeviceModel()).toBe('Chrome')
        expect(service.getDeviceModelId()).toBe('125.0.6422.112')
    })

    it('builds a user agent mirroring the mobile format', () => {
        configMock.config.appBuildNumber = '1234'
        expect(service.getUserAgent()).toBe(
            'Pera Wallet/0.1.0.1234 (web; Chrome 125.0.6422.112; macOS 10.15.7) pera_web_0.1.0',
        )
    })

    it('generates a device ID once and persists it', async () => {
        const first = await service.getDeviceID()
        const second = await service.getDeviceID()
        expect(first).toBe(second)
        expect(fake.data.get('device:id')).toBe(first)
    })

    it('collapses concurrent getDeviceID calls to a single generated ID', async () => {
        const [a, b] = await Promise.all([
            service.getDeviceID(),
            service.getDeviceID(),
        ])
        expect(a).toBe(b)
        expect(fake.data.get('device:id')).toBe(a)
    })

    it('is not a store build without an update_url', () => {
        expect(service.isStoreBuild()).toBe(false)
    })

    it('returns every navigator language', () => {
        vi.stubGlobal('navigator', {
            userAgent: CHROME_UA,
            language: 'en-US',
            languages: ['en-US', 'en', 'fr'],
        })
        service = new ChromeDeviceInfoService()

        expect(service.getDeviceLocales()).toEqual(['en-US', 'en', 'fr'])
    })

    it('falls back to the single navigator language when languages is absent', () => {
        vi.stubGlobal('navigator', {
            userAgent: CHROME_UA,
            language: 'en-US',
        })
        service = new ChromeDeviceInfoService()

        expect(service.getDeviceLocales()).toEqual(['en-US'])
    })
})
