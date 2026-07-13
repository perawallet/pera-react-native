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

import { beforeEach, describe, expect, it } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import { ChromeDeviceInfoService } from '../device'

describe('ChromeDeviceInfoService', () => {
    let fake: ChromeFake
    let service: ChromeDeviceInfoService

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
        service = new ChromeDeviceInfoService()
    })

    it('reads app identity from the manifest and runtime', () => {
        expect(service.getAppName()).toBe('Pera Wallet')
        expect(service.getAppVersion()).toBe('0.1.0')
        expect(service.getAppBuild()).toBe('0.1.0')
        expect(service.getAppId()).toBe('test-extension-id')
        expect(service.getAppPackage()).toBe('test-extension-id')
    })

    it('reports the web platform', () => {
        expect(service.getDevicePlatform()).toBe('web')
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
})
