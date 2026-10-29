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
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { EnsureCanReceiveParams } from '../../chain-adapter'
import { rampChainAdapters } from '../../chain-adapter'
import { registerFakeRampAdapter } from '../../__tests__/fakeRampAdapter'
import { useEnsureRampDestination } from '../useEnsureRampDestination'

const PARAMS: EnsureCanReceiveParams = {
    address: 'ADDR',
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    destinationToken: {
        id: 'STABLE',
        symbol: 'STB',
        network: { id: 'FAKE', name: 'Fake', logo: null },
    },
}

describe('useEnsureRampDestination', () => {
    beforeEach(() => {
        rampChainAdapters.reset()
    })

    test("returns the adapter hook's function", async () => {
        const ensureCanReceive = vi.fn().mockResolvedValue(false)
        const useEnsureCanReceive = vi.fn(() => ensureCanReceive)
        registerFakeRampAdapter({ useEnsureCanReceive })

        const { result } = renderHook(() =>
            useEnsureRampDestination('algorand'),
        )
        const confirmed = await result.current.ensureCanReceive(PARAMS)

        expect(useEnsureCanReceive).toHaveBeenCalled()
        expect(ensureCanReceive).toHaveBeenCalledWith(PARAMS)
        expect(confirmed).toBe(false)
    })

    test('resolves true without preparation when the adapter has no hook', async () => {
        registerFakeRampAdapter()

        const { result, rerender } = renderHook(() =>
            useEnsureRampDestination('algorand'),
        )
        const first = result.current.ensureCanReceive
        rerender()

        expect(result.current.ensureCanReceive).toBe(first)
        await expect(first(PARAMS)).resolves.toBe(true)
    })

    test.each([null, 'ethereum' as const])(
        'resolves true without preparation for chain %s, which has no ramp adapter',
        async chainId => {
            registerFakeRampAdapter()

            const { result } = renderHook(() =>
                useEnsureRampDestination(chainId),
            )

            await expect(result.current.ensureCanReceive(PARAMS)).resolves.toBe(
                true,
            )
        },
    )
})
