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

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    appEnvironment: 'development',
    isStoreBuild: false,
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            get appEnvironment() {
                return mocks.appEnvironment
            },
        },
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: { isStoreBuild: () => mocks.isStoreBuild },
    }),
}))

import { isCustomNetworkOffered } from '../isCustomNetworkOffered.web'

describe('isCustomNetworkOffered (web)', () => {
    beforeEach(() => {
        mocks.appEnvironment = 'development'
        mocks.isStoreBuild = false
    })

    it('is withheld in a store-installed production build', () => {
        mocks.appEnvironment = 'production'
        mocks.isStoreBuild = true

        expect(isCustomNetworkOffered()).toBe(false)
    })

    it('is offered in an unpacked production build', () => {
        mocks.appEnvironment = 'production'

        expect(isCustomNetworkOffered()).toBe(true)
    })

    it('is offered outside production even in a store build', () => {
        mocks.isStoreBuild = true

        expect(isCustomNetworkOffered()).toBe(true)
    })
})
