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
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import {
    submitCosignedSwapGroup,
    swapAdapterFor,
    swapChainAdapters,
    SwapCosignUnsupportedError,
} from '../chain-adapter'
import { fakeSwapAdapter } from './fakeSwapAdapter'

describe('swapAdapterFor', () => {
    beforeEach(() => {
        swapChainAdapters.reset()
    })

    it("resolves a legacy network to its chain's adapter", () => {
        const adapter = fakeSwapAdapter()
        swapChainAdapters.register(adapter)

        expect(swapAdapterFor('testnet')).toBe(adapter)
    })

    it('names the missing feature when no adapter is registered', () => {
        expect(() => swapAdapterFor('mainnet')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => swapAdapterFor('mainnet')).toThrow(
            'No swap adapter is registered for chain "algorand"',
        )
    })
})

describe('submitCosignedSwapGroup', () => {
    beforeEach(() => {
        swapChainAdapters.reset()
    })

    it("submits through the chain's co-sign support", async () => {
        const submitSignedGroup = vi.fn().mockResolvedValue(['TX1'])
        swapChainAdapters.register(fakeSwapAdapter({ submitSignedGroup }))
        const signed = [new Uint8Array([1])]

        const txIds = await submitCosignedSwapGroup('mainnet', signed)

        expect(txIds).toEqual(['TX1'])
        expect(submitSignedGroup).toHaveBeenCalledWith('mainnet', signed)
    })

    it('refuses when the chain has no co-sign support', async () => {
        swapChainAdapters.register(
            fakeSwapAdapter({ submitSignedGroup: undefined }),
        )

        await expect(
            submitCosignedSwapGroup('mainnet', [new Uint8Array([1])]),
        ).rejects.toBeInstanceOf(SwapCosignUnsupportedError)
    })
})
