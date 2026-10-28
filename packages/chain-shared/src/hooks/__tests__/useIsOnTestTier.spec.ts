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
import { describe, test, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useNetworkStore } from '../../store/network-store'
import { useIsOnTestTier } from '../useIsOnTestTier'

const capabilities = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, false]),
) as ChainCapabilities

const registerChain = (id: string, testNetworkId: string): void => {
    getProvider().chains.register(
        {
            id: id as ChainId,
            networks: [
                { id: 'mainnet', tier: 'mainnet', isDefaultForTier: true },
                { id: testNetworkId, tier: 'testnet', isDefaultForTier: true },
            ],
        } as unknown as ChainDescriptor,
        capabilities,
    )
}

const BOTH_CHAINS = ['algorand', 'ethereum'] as ChainId[]

describe('useIsOnTestTier', () => {
    beforeEach(() => {
        useNetworkStore.getState().resetState()
    })

    describe('with two chains registered', () => {
        beforeEach(() => {
            registerChain('algorand', 'testnet')
            registerChain('ethereum', 'sepolia')
        })

        test('is false in live mode', () => {
            const { result } = renderHook(() => useIsOnTestTier(BOTH_CHAINS))

            expect(result.current).toBe(false)
        })

        test('turns true when the wallet switches to developer mode', () => {
            const { result } = renderHook(() =>
                useIsOnTestTier(['ethereum' as ChainId]),
            )

            act(() => {
                useNetworkStore.getState().setMode('developer')
            })

            expect(result.current).toBe(true)
        })

        test('is false for an account with no chains', () => {
            useNetworkStore.getState().setMode('developer')

            const { result } = renderHook(() => useIsOnTestTier([]))

            expect(result.current).toBe(false)
        })
    })

    test('is false in developer mode with a single chain registered', () => {
        registerChain('algorand', 'testnet')
        useNetworkStore.getState().setMode('developer')

        const { result } = renderHook(() =>
            useIsOnTestTier(['algorand' as ChainId]),
        )

        expect(result.current).toBe(false)
    })
})
