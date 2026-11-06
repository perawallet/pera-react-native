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

import { describe, expect, it, vi } from 'vitest'
import { canHideHolding, receivesUnaskedAssets } from '../chainProtocol'

const mocks = vi.hoisted(() => ({
    has: vi.fn(),
    getChainDescriptor: vi.fn(),
    isNativeAssetId: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ chains: { has: mocks.has } }),
}))
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: mocks.getChainDescriptor,
}))
vi.mock('@perawallet/wallet-core-assets', () => ({
    isNativeAssetId: mocks.isNativeAssetId,
}))

const chain = (requiresAssetOptIn: boolean) => {
    mocks.has.mockReturnValue(true)
    mocks.getChainDescriptor.mockReturnValue({
        protocol: { requiresAssetOptIn },
    })
}

describe('receivesUnaskedAssets', () => {
    it('is true for a registered chain without opt-in', () => {
        chain(false)

        expect(receivesUnaskedAssets('ethereum')).toBe(true)
    })

    it('is false for a chain where the account opts in to each asset', () => {
        chain(true)

        expect(receivesUnaskedAssets('algorand')).toBe(false)
    })

    it('is false for a chain this build does not register', () => {
        mocks.has.mockReturnValue(false)

        expect(receivesUnaskedAssets('ethereum')).toBe(false)
        expect(mocks.getChainDescriptor).not.toHaveBeenCalled()
    })
})

describe('canHideHolding', () => {
    it('is true for a token on a chain without opt-in', () => {
        chain(false)
        mocks.isNativeAssetId.mockReturnValue(false)

        expect(canHideHolding('ethereum', '0xtoken')).toBe(true)
    })

    it('is false for the native coin', () => {
        chain(false)
        mocks.isNativeAssetId.mockReturnValue(true)

        expect(canHideHolding('ethereum', 'native')).toBe(false)
    })

    it('is false for an asset on a chain with opt-in', () => {
        chain(true)
        mocks.isNativeAssetId.mockReturnValue(false)

        expect(canHideHolding('algorand', '31566704')).toBe(false)
    })
})
