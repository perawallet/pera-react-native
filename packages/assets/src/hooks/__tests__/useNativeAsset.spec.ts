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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { assetsChainAdapters } from '../../chain-adapter'
import {
    FAKE_NATIVE_ASSET,
    registerFakeAssetsAdapter,
} from '../../__tests__/fakeAssetsChain'
import { useNativeAsset } from '../useNativeAsset'

const mocks = vi.hoisted(() => ({ useNetwork: vi.fn() }))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mocks.useNetwork,
}))

describe('useNativeAsset', () => {
    beforeEach(() => {
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
    })

    it("returns the registered chain's native asset, with the same reference across renders", () => {
        registerFakeAssetsAdapter()

        const { result, rerender } = renderHook(() => useNativeAsset())
        const first = result.current
        rerender()

        expect(first).toBe(FAKE_NATIVE_ASSET)
        expect(result.current).toBe(first)
    })

    it('throws when the chain has no adapter', () => {
        assetsChainAdapters.reset()

        expect(() => renderHook(() => useNativeAsset())).toThrow(
            ChainAdapterNotRegisteredError,
        )
    })
})
