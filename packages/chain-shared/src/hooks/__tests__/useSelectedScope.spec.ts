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
import {
    useSelectedChainMode,
    useSelectedNetworkId,
    useSelectedScope,
} from '../useSelectedScope'

describe('useSelectedScope', () => {
    beforeEach(() => {
        useNetworkStore.getState().resetState()
    })

    test('returns the chain scope and follows the mode and override', () => {
        const { result } = renderHook(() => useSelectedScope('algorand'))
        expect(result.current).toEqual({
            chainId: 'algorand',
            networkId: 'mainnet',
        })

        act(() => {
            useNetworkStore.getState().setMode('developer')
            useNetworkStore.getState().selectNetwork('algorand', 'betanet')
        })

        expect(result.current).toEqual({
            chainId: 'algorand',
            networkId: 'betanet',
        })
    })

    test('useSelectedNetworkId returns the bare id', () => {
        const { result } = renderHook(() => useSelectedNetworkId('algorand'))

        expect(result.current).toBe('mainnet')
    })

    test('useSelectedChainMode follows the mode and the override', () => {
        const { result } = renderHook(() => useSelectedChainMode('algorand'))
        expect(result.current).toBe('live')

        act(() => {
            useNetworkStore.getState().setMode('developer')
        })
        expect(result.current).toBe('developer')

        act(() => {
            useNetworkStore.getState().selectNetwork('algorand', 'betanet')
        })
        expect(result.current).toBe('developer-override')
    })

    test('a registered chain with no stored entry follows the mode', () => {
        const ethereum = 'ethereum' as ChainId
        getProvider().chains.register(
            {
                id: ethereum,
                networks: [
                    { id: 'mainnet', tier: 'mainnet', isDefaultForTier: true },
                    { id: 'sepolia', tier: 'testnet', isDefaultForTier: true },
                ],
            } as unknown as ChainDescriptor,
            Object.fromEntries(
                CHAIN_CAPABILITIES.map(capability => [capability, false]),
            ) as ChainCapabilities,
        )
        const { result } = renderHook(() => useSelectedNetworkId(ethereum))
        expect(result.current).toBe('mainnet')

        act(() => {
            useNetworkStore.getState().setMode('developer')
        })

        expect(result.current).toBe('sepolia')
    })
})
