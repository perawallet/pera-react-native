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

// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { EnsureSwapReceivable } from '../../chain-adapter'
import { swapChainAdapters } from '../../chain-adapter'
import { registerFakeSwapAdapter } from '../../__tests__/fakeSwapAdapter'
import { useEnsureSwapDestination } from '../useEnsureSwapDestination'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const PARAMS = { address: 'ADDRESS', scope: SCOPE, assetId: '1' }

describe('swaps/useEnsureSwapDestination', () => {
    afterEach(() => {
        swapChainAdapters.reset()
    })

    test("runs the chain's own preparation", async () => {
        const ensureReceivable: EnsureSwapReceivable = vi.fn(async () => false)
        registerFakeSwapAdapter({
            useEnsureReceivable: () => ensureReceivable,
        })

        const { result } = renderHook(() => useEnsureSwapDestination(SCOPE))

        await expect(result.current.ensureReceivable(PARAMS)).resolves.toBe(
            false,
        )
        expect(ensureReceivable).toHaveBeenCalledWith(PARAMS)
    })

    test('has nothing to prepare on a chain with no such step', async () => {
        registerFakeSwapAdapter()

        const { result } = renderHook(() => useEnsureSwapDestination(SCOPE))

        await expect(result.current.ensureReceivable(PARAMS)).resolves.toBe(
            true,
        )
    })

    test('has nothing to prepare on a chain with no adapter', async () => {
        const { result } = renderHook(() => useEnsureSwapDestination(SCOPE))

        await expect(result.current.ensureReceivable(PARAMS)).resolves.toBe(
            true,
        )
    })
})
