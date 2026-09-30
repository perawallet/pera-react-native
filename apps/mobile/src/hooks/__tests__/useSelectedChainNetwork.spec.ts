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
import { act, renderHook } from '@testing-library/react'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    ETHEREUM_CHAIN_ID,
    allCapabilities,
    fixtureEthereumDescriptor,
} from '@test-utils/chain-fixtures'
import { useSelectedChainNetwork } from '@hooks/useSelectedChainNetwork'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => `t:${key}` }),
}))

describe('useSelectedChainNetwork', () => {
    beforeEach(() => {
        const { chains } = getProvider()
        chains.reset()
        chains.register(algorandDescriptor, allCapabilities(true))
        chains.register(fixtureEthereumDescriptor, allCapabilities(false))
        useNetworkStore.getState().resetState()
    })

    it('resolves a stored network against its descriptor', () => {
        useNetworkStore.getState().selectNetwork(ETHEREUM_CHAIN_ID, 'sepolia')

        const { result } = renderHook(() =>
            useSelectedChainNetwork(ETHEREUM_CHAIN_ID),
        )

        expect(result.current).toEqual({
            networkId: 'sepolia',
            isMainnet: false,
            label: 'Sepolia',
        })
    })

    it('falls back to the default mainnet for a chain nobody has picked a network on', () => {
        const { result } = renderHook(() =>
            useSelectedChainNetwork(ETHEREUM_CHAIN_ID),
        )

        expect(result.current).toEqual({
            networkId: 'mainnet',
            isMainnet: true,
            label: 'Mainnet',
        })
    })

    it('falls back to the default mainnet for an id the descriptor does not list', () => {
        useNetworkStore.getState().selectNetwork(ETHEREUM_CHAIN_ID, 'holesky')

        const { result } = renderHook(() =>
            useSelectedChainNetwork(ETHEREUM_CHAIN_ID),
        )

        expect(result.current.networkId).toBe('mainnet')
        expect(result.current.isMainnet).toBe(true)
    })

    it('treats a custom network as non-mainnet with the custom label', () => {
        useNetworkStore.getState().selectNetwork('algorand', 'custom')

        const { result } = renderHook(() => useSelectedChainNetwork('algorand'))

        expect(result.current).toEqual({
            networkId: 'custom',
            isMainnet: false,
            label: 't:common.network_label.custom',
        })
    })

    it('follows a selection made after it mounted', () => {
        const { result } = renderHook(() => useSelectedChainNetwork('algorand'))

        act(() => {
            useNetworkStore.getState().selectNetwork('algorand', 'testnet')
        })

        expect(result.current.networkId).toBe('testnet')
        expect(result.current.isMainnet).toBe(false)
    })
})
