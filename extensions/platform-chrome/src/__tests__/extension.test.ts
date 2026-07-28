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
import { createChromeFake } from '../test-utils/chrome'
import { WithChromePlatformExtension } from '../extension'
import { getPlatformServices, hydratePlatform } from '../resources'

describe('WithChromePlatformExtension', () => {
    beforeEach(() => {
        globalThis.chrome = createChromeFake().chrome
    })

    it('exposes every PlatformServices member', () => {
        const extension = WithChromePlatformExtension(undefined)
        for (const key of [
            'keyValueStorage',
            'biometrics',
            'ageGate',
            'pushNotification',
            'remoteConfig',
            'analytics',
            'crashReporting',
            'deviceInfo',
            'appIntegrity',
            'database',
            'hardwareWalletRegistry',
            'migration',
        ] as const) {
            expect(extension[key]).toBeDefined()
        }
    })

    it('initialize() resolves a push init result', async () => {
        const extension = WithChromePlatformExtension(undefined)
        const result = await extension.initialize()
        expect(result.token).toBeUndefined()
        expect(typeof result.unsubscribe).toBe('function')
    })

    it('hydratePlatform enables sync storage reads', async () => {
        await hydratePlatform()
        const services = getPlatformServices()
        services.keyValueStorage.setItem('k', 'v')
        expect(services.keyValueStorage.getItem('k')).toBe('v')
    })
})
