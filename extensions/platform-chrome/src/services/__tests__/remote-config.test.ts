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

import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockGetValue, mockFetchAndActivate, mockGetRemoteConfig } = vi.hoisted(
    () => ({
        mockGetValue: vi.fn(),
        mockFetchAndActivate: vi.fn().mockResolvedValue(true),
        mockGetRemoteConfig: vi.fn(() => ({ settings: {}, defaultConfig: {} })),
    }),
)

vi.mock('firebase/remote-config', () => ({
    getRemoteConfig: mockGetRemoteConfig,
    fetchAndActivate: mockFetchAndActivate,
    getValue: mockGetValue,
}))

const getFirebaseAppMock = vi.hoisted(() => vi.fn())
vi.mock('../firebase-app', () => ({ getFirebaseApp: getFirebaseAppMock }))

const configMock = vi.hoisted(() => ({
    config: {
        remoteConfigRefreshTime: 3_600_000,
        appEnvironment: 'development',
    },
    isDebug: true,
}))
vi.mock('@perawallet/wallet-core-config', () => configMock)

import { ChromeRemoteConfigService } from '../remote-config'

describe('ChromeRemoteConfigService', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('falls back to bundled defaults when no Firebase app is available', async () => {
        getFirebaseAppMock.mockReturnValue(null)
        const service = new ChromeRemoteConfigService()
        await service.initializeRemoteConfig()

        expect(service.getNumberValue('fee_min_txn_fee')).toBe(1000)
        expect(service.getBooleanValue('enable_pera_card')).toBe(false)
        expect(service.getStringValue('terms_version')).toBe('1')
        expect(mockFetchAndActivate).not.toHaveBeenCalled()
    })

    it('falls back for unknown keys with no Firebase app', () => {
        getFirebaseAppMock.mockReturnValue(null)
        const service = new ChromeRemoteConfigService()
        expect(service.getStringValue('nope', 'fb')).toBe('fb')
        expect(service.getBooleanValue('nope', true)).toBe(true)
        expect(service.getNumberValue('nope', 7)).toBe(7)
    })

    it('fetches and activates when a Firebase app is available', async () => {
        getFirebaseAppMock.mockReturnValue({ name: '[DEFAULT]' })
        const service = new ChromeRemoteConfigService()
        await service.initializeRemoteConfig()

        expect(mockGetRemoteConfig).toHaveBeenCalledWith({ name: '[DEFAULT]' })
        expect(mockFetchAndActivate).toHaveBeenCalled()
    })

    it('only trusts a genuinely fetched boolean value, not the seeded default', async () => {
        getFirebaseAppMock.mockReturnValue({ name: '[DEFAULT]' })
        mockGetValue.mockReturnValue({
            getSource: () => 'default',
            asBoolean: () => true,
            asString: () => '',
            asNumber: () => 0,
        })
        const service = new ChromeRemoteConfigService()
        await service.initializeRemoteConfig()

        // Source is 'default' (seeded, not fetched) — must honour the
        // caller's fallback rather than the seeded value.
        expect(service.getBooleanValue('enable_pera_card', false)).toBe(false)

        mockGetValue.mockReturnValue({
            getSource: () => 'remote',
            asBoolean: () => true,
            asString: () => '',
            asNumber: () => 0,
        })
        expect(service.getBooleanValue('enable_pera_card', false)).toBe(true)
    })

    it("honours the caller's fallback over the bundled default when the source isn't remote", async () => {
        // enable_pera_card's bundled default is `false`. A caller like
        // useIsPeraCardEnabled passes `true` in dev/staging specifically to
        // override that default. Before the first successful fetch,
        // getSource() is 'default', not 'remote' — the bundled default must
        // NOT win over the caller's fallback here.
        getFirebaseAppMock.mockReturnValue({ name: '[DEFAULT]' })
        mockGetValue.mockReturnValue({
            getSource: () => 'default',
            asBoolean: () => false,
            asString: () => '',
            asNumber: () => 0,
        })
        const service = new ChromeRemoteConfigService()
        await service.initializeRemoteConfig()

        expect(service.getBooleanValue('enable_pera_card', true)).toBe(true)
    })

    // A missing Firebase project means every remote flag silently serves its
    // bundled default — `staking_projects: ''` renders an empty Staking screen
    // that reads as a backend outage rather than a misconfigured build. A warn
    // nobody reads is not enough signal for a shipped zip.
    describe('when the Firebase project is missing', () => {
        afterEach(() => {
            configMock.isDebug = true
        })

        it('warns only, in a dev build', async () => {
            configMock.isDebug = true
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
            const error = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})
            getFirebaseAppMock.mockReturnValue(null)

            await new ChromeRemoteConfigService().initializeRemoteConfig()

            expect(warn).toHaveBeenCalled()
            expect(error).not.toHaveBeenCalled()
        })

        it('escalates to an error in a shipped build', async () => {
            configMock.isDebug = false
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
            const error = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})
            getFirebaseAppMock.mockReturnValue(null)

            await new ChromeRemoteConfigService().initializeRemoteConfig()

            expect(error).toHaveBeenCalled()
            expect(warn).not.toHaveBeenCalled()
        })
    })
})
