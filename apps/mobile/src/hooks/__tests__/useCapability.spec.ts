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
import { renderHook } from '@testing-library/react'
import type { ChainMode } from '@perawallet/wallet-core-chain-contract'
import { useCapability, useCapabilityCheck } from '../useCapability'

const mocks = vi.hoisted(() => ({
    chainMode: 'live' as ChainMode,
    isChainAllowed: true,
    checkChain: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapabilityCheck: () => mocks.checkChain,
    useSelectedChainMode: () => mocks.chainMode,
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: { peraCard: true, staking: true, swapTab: false },
    routeCapabilityRestrictions: { peraCard: ['developer-override'] },
}))

describe('useCapability', () => {
    beforeEach(() => {
        mocks.chainMode = 'live'
        mocks.isChainAllowed = true
        mocks.checkChain.mockImplementation(() => mocks.isChainAllowed)
    })

    it.each([
        ['live', true],
        ['developer', true],
        ['developer-override', false],
    ] as const)(
        'a restricted platform capability in %s is %s',
        (mode, expected) => {
            mocks.chainMode = mode

            const { result } = renderHook(() =>
                useCapability({ platform: 'peraCard' }),
            )

            expect(result.current).toBe(expected)
        },
    )

    it.each(['live', 'developer', 'developer-override'] as const)(
        'an unrestricted platform capability is unchanged in %s',
        mode => {
            mocks.chainMode = mode

            const { result } = renderHook(() =>
                useCapability({ platform: 'staking' }),
            )

            expect(result.current).toBe(true)
        },
    )

    it('keeps a platform capability that is off on this platform off', () => {
        const { result } = renderHook(() =>
            useCapability({ platform: 'swapTab' }),
        )

        expect(result.current).toBe(false)
    })

    it('needs the chain part and the platform part to both hold', () => {
        mocks.isChainAllowed = false

        const { result } = renderHook(() =>
            useCapability({ platform: 'staking', anyChain: 'onramp' }),
        )

        expect(mocks.checkChain).toHaveBeenCalledWith({
            anyChain: 'onramp',
        })
        expect(result.current).toBe(false)
    })

    it('passes with an empty requirement', () => {
        const { result } = renderHook(() => useCapability({}))

        expect(result.current).toBe(true)
    })

    it('evaluates several requirements from one checker', () => {
        const { result } = renderHook(() => useCapabilityCheck())

        expect(result.current({ platform: 'staking' })).toBe(true)
        expect(result.current({ platform: 'swapTab' })).toBe(false)
        mocks.isChainAllowed = false
        expect(result.current({ anyChain: 'swap' })).toBe(false)
    })
})
