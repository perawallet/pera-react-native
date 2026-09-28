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

import { describe, test, expect, vi } from 'vitest'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { DevicePlatform } from '@perawallet/wallet-extension-platform'
import { areConfigOverridesIgnored } from '../areConfigOverridesIgnored'

const mockConfig = vi.hoisted(() => ({ appEnvironment: 'development' }))

vi.mock('@perawallet/wallet-core-config', () => ({ config: mockConfig }))

const mockDevice = (
    platform: DevicePlatform,
    appEnvironment: string,
    isStoreBuild: boolean,
) => {
    mockConfig.appEnvironment = appEnvironment
    vi.mocked(getProvider).mockReturnValue({
        deviceInfo: {
            getDevicePlatform: () => platform,
            isStoreBuild: () => isStoreBuild,
        },
    } as unknown as ReturnType<typeof getProvider>)
}

describe('areConfigOverridesIgnored', () => {
    test('ignores overrides in a store-installed production extension', () => {
        mockDevice('web', 'production', true)

        expect(areConfigOverridesIgnored()).toBe(true)
    })

    test.each([
        ['an unpacked production extension', 'web', 'production', false],
        ['a store-installed staging extension', 'web', 'staging', true],
        ['the production mobile app', 'ios', 'production', true],
    ] as const)('keeps overrides in %s', (_, platform, env, isStoreBuild) => {
        mockDevice(platform, env, isStoreBuild)

        expect(areConfigOverridesIgnored()).toBe(false)
    })
})
