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
import { useChainNetworkPicker } from '../useChainNetworkPicker'

const mocks = vi.hoisted(() => ({
    restart: vi.fn(),
    getSyncService: vi.fn(),
    requestBottomSheet: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: () => mocks.getSyncService(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mocks.requestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: { chain: string; network: string }) =>
            options ? `${options.chain} ${options.network}` : `t:${key}`,
    }),
}))

const registerChains = (isAlgorandCustomEnabled = true) => {
    const { chains } = getProvider()
    chains.reset()
    chains.register(algorandDescriptor, {
        ...allCapabilities(true),
        customNetworks: isAlgorandCustomEnabled,
    })
    chains.register(fixtureEthereumDescriptor, allCapabilities(false))
}

describe('useChainNetworkPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getSyncService.mockReturnValue({ restart: mocks.restart })
        registerChains()
        useNetworkStore.getState().resetState()
        useNetworkStore.getState().selectNetwork('algorand', 'mainnet')
    })

    it('lists Algorand as MainNet, TestNet, BetaNet then Custom', () => {
        const { result } = renderHook(() => useChainNetworkPicker('algorand'))

        expect(result.current.networks.map(row => row.label)).toEqual([
            'Algorand MainNet',
            'Algorand TestNet',
            'Algorand BetaNet',
            't:settings.developer.node_settings.custom_label',
        ])
        expect(result.current.networks.map(row => row.networkId)).toEqual([
            'mainnet',
            'testnet',
            'betanet',
            'custom',
        ])
    })

    it('hides a deprecated network and, with customNetworks off, the Custom row', () => {
        const { result } = renderHook(() =>
            useChainNetworkPicker(ETHEREUM_CHAIN_ID),
        )

        expect(result.current.networks.map(row => row.networkId)).toEqual([
            'mainnet',
            'sepolia',
        ])
    })

    it('drops Custom from a chain whose customNetworks capability is switched off', () => {
        registerChains(false)

        const { result } = renderHook(() => useChainNetworkPicker('algorand'))

        expect(result.current.networks.map(row => row.networkId)).toEqual([
            'mainnet',
            'testnet',
            'betanet',
        ])
    })

    it('marks the stored network selected, and the default mainnet when nothing is stored', () => {
        useNetworkStore.getState().selectNetwork('algorand', 'testnet')

        const algorand = renderHook(() => useChainNetworkPicker('algorand'))
        const ethereum = renderHook(() =>
            useChainNetworkPicker(ETHEREUM_CHAIN_ID),
        )

        expect(
            algorand.result.current.networks.filter(row => row.isSelected),
        ).toEqual([expect.objectContaining({ networkId: 'testnet' })])
        expect(
            ethereum.result.current.networks.filter(row => row.isSelected),
        ).toEqual([expect.objectContaining({ networkId: 'mainnet' })])
    })

    it('selecting a network writes that chain only and restarts the sync', async () => {
        const { result } = renderHook(() =>
            useChainNetworkPicker(ETHEREUM_CHAIN_ID),
        )

        await act(async () => {
            await result.current.selectNetwork('sepolia')
        })

        const { selectedNetworkByChain } = useNetworkStore.getState()
        expect(
            (selectedNetworkByChain as Record<string, string>).ethereum,
        ).toBe('sepolia')
        expect(selectedNetworkByChain.algorand).toBe('mainnet')
        expect(mocks.restart).toHaveBeenCalledOnce()
    })

    it('selecting the current network does nothing', async () => {
        const { result } = renderHook(() => useChainNetworkPicker('algorand'))

        await act(async () => {
            await result.current.selectNetwork('mainnet')
        })

        expect(mocks.restart).not.toHaveBeenCalled()
    })

    it('still selects when the sync service is not initialised', async () => {
        mocks.getSyncService.mockImplementation(() => {
            throw new Error('SyncService not yet initialized')
        })
        const { result } = renderHook(() => useChainNetworkPicker('algorand'))

        await act(async () => {
            await result.current.selectNetwork('testnet')
        })

        expect(useNetworkStore.getState().selectedNetworkByChain.algorand).toBe(
            'testnet',
        )
    })

    it('selecting custom requests the sheet and writes nothing', async () => {
        const { result } = renderHook(() => useChainNetworkPicker('algorand'))

        await act(async () => {
            await result.current.selectNetwork('custom')
        })

        expect(mocks.requestBottomSheet).toHaveBeenCalledOnce()
        expect(useNetworkStore.getState().selectedNetworkByChain.algorand).toBe(
            'mainnet',
        )
        expect(mocks.restart).not.toHaveBeenCalled()
    })

    it('flags a non-mainnet selection for the badge and callout only', () => {
        useNetworkStore.getState().selectNetwork(ETHEREUM_CHAIN_ID, 'sepolia')

        const ethereum = renderHook(() =>
            useChainNetworkPicker(ETHEREUM_CHAIN_ID),
        )
        const algorand = renderHook(() => useChainNetworkPicker('algorand'))

        expect(ethereum.result.current.isNonMainnet).toBe(true)
        expect(ethereum.result.current.selectedLabel).toBe('Sepolia')
        expect(algorand.result.current.isNonMainnet).toBe(false)
    })
})
