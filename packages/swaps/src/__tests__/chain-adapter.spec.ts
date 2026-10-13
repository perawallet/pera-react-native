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
import {
    ChainAdapterNotRegisteredError,
    scopeForLegacyNetwork,
} from '@perawallet/wallet-core-chain-contract'
import {
    submitCosignedSwapGroup,
    swapAdapterFor,
    swapChainAdapters,
    SwapCosignUnsupportedError,
} from '../chain-adapter'
import { fakeSwapAdapter, registerFakeBroadcaster } from './fakeSwapAdapter'

describe('swapAdapterFor', () => {
    beforeEach(() => {
        swapChainAdapters.reset()
    })

    it("resolves a legacy network to its chain's adapter", () => {
        const adapter = fakeSwapAdapter()
        swapChainAdapters.register(adapter)

        expect(swapAdapterFor(scopeForLegacyNetwork('testnet'))).toBe(adapter)
    })

    it('names the missing feature when no adapter is registered', () => {
        expect(() => swapAdapterFor(scopeForLegacyNetwork('mainnet'))).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => swapAdapterFor(scopeForLegacyNetwork('mainnet'))).toThrow(
            'No swap adapter is registered for chain "algorand"',
        )
    })
})

describe('submitCosignedSwapGroup', () => {
    const submit = vi.fn()

    beforeEach(() => {
        swapChainAdapters.reset()
        submit.mockReset()
        registerFakeBroadcaster(submit)
    })

    it("submits through the chain's broadcaster", async () => {
        submit.mockResolvedValue(['TX1'])
        swapChainAdapters.register(fakeSwapAdapter())
        const signed = [new Uint8Array([1])]
        const scope = scopeForLegacyNetwork('mainnet')

        const txIds = await submitCosignedSwapGroup(scope, signed)

        expect(txIds).toEqual(['TX1'])
        expect(submit).toHaveBeenCalledWith(scope, signed)
    })

    it('refuses when the chain has no co-sign support', async () => {
        swapChainAdapters.register(
            fakeSwapAdapter({ supportsCosignedSwaps: false }),
        )

        await expect(
            submitCosignedSwapGroup(scopeForLegacyNetwork('mainnet'), [
                new Uint8Array([1]),
            ]),
        ).rejects.toBeInstanceOf(SwapCosignUnsupportedError)
        expect(submit).not.toHaveBeenCalled()
    })
})
