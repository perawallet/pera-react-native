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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { rampChainAdapters } from '../../chain-adapter'
import { registerFakeRampAdapter } from '../../__tests__/fakeRampAdapter'
import { useEnsureRampDestination } from '../useEnsureRampDestination'

describe('useEnsureRampDestination', () => {
    beforeEach(() => {
        rampChainAdapters.reset()
    })

    test("returns the adapter hook's function", async () => {
        const ensureCanReceive = vi.fn().mockResolvedValue(false)
        const useEnsureCanReceive = vi.fn(() => ensureCanReceive)
        registerFakeRampAdapter({ useEnsureCanReceive })

        const { result } = renderHook(() => useEnsureRampDestination('mainnet'))
        const params = { address: 'ADDR', destinationAssetId: 5n }
        const confirmed = await result.current.ensureCanReceive(params)

        expect(useEnsureCanReceive).toHaveBeenCalled()
        expect(ensureCanReceive).toHaveBeenCalledWith(params)
        expect(confirmed).toBe(false)
    })

    test('resolves true without preparation when the adapter has no hook', async () => {
        registerFakeRampAdapter()

        const { result, rerender } = renderHook(() =>
            useEnsureRampDestination('mainnet'),
        )
        const first = result.current.ensureCanReceive
        rerender()

        expect(result.current.ensureCanReceive).toBe(first)
        await expect(
            first({ address: 'ADDR', destinationAssetId: 5n }),
        ).resolves.toBe(true)
    })

    test('throws when no ramp adapter is registered for the chain', () => {
        expect(() =>
            renderHook(() => useEnsureRampDestination('mainnet')),
        ).toThrow(ChainAdapterNotRegisteredError)
    })
})
