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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    algorandCapabilityDefaults,
    algorandDescriptor,
} from '@perawallet/wallet-core-chain-algorand/descriptor'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    allCapabilities,
    ETHEREUM_CHAIN_ID,
    fixtureEthereumDescriptor,
} from '@test-utils/chain-fixtures'
import { useSettingsDeveloperNodeSettingsScreen } from '../useSettingsDeveloperNodeSettingsScreen'

const mocks = vi.hoisted(() => ({
    restart: vi.fn(),
    getSyncService: vi.fn(),
    requestBottomSheet: vi.fn(),
    isCustomNetworkOffered: vi.fn(() => true),
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

vi.mock('../isCustomNetworkOffered', () => ({
    isCustomNetworkOffered: () => mocks.isCustomNetworkOffered(),
}))

// Echoes the key, with the interpolated values when there are any, so the
// one-chain labels can be told apart from the tier labels.
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: { chain?: string; network?: string }) =>
            options ? `${key}(${options.chain} ${options.network})` : key,
    }),
}))

const NETWORK_LABEL = 'settings.developer.node_settings.network_label'
const CUSTOM_LABEL = 'settings.developer.node_settings.custom_label'

const registerEthereum = (customNetworks = false) =>
    getProvider().chains.register(fixtureEthereumDescriptor, {
        ...allCapabilities(false),
        customNetworks,
    })

const renderScreenHook = () =>
    renderHook(() => useSettingsDeveloperNodeSettingsScreen())

describe('useSettingsDeveloperNodeSettingsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isCustomNetworkOffered.mockReturnValue(true)
        mocks.getSyncService.mockReturnValue({ restart: mocks.restart })
        getProvider().chains.reset()
        getProvider().chains.register(
            algorandDescriptor,
            algorandCapabilityDefaults,
        )
        useNetworkStore.getState().resetState()
    })

    describe('with Algorand only', () => {
        it('lists MainNet, TestNet and Custom with the chain name in each label', () => {
            const { result } = renderScreenHook()

            expect(result.current.rows).toEqual([
                {
                    globalNetwork: 'mainnet',
                    label: `${NETWORK_LABEL}(Algorand MainNet)`,
                    isSelected: true,
                },
                {
                    globalNetwork: 'testnet',
                    label: `${NETWORK_LABEL}(Algorand TestNet)`,
                    isSelected: false,
                },
                {
                    globalNetwork: 'custom',
                    label: CUSTOM_LABEL,
                    isSelected: false,
                },
            ])
            expect(result.current.chainNetworks).toEqual([])
        })

        it('switches Algorand from a BetaNet pin to TestNet', async () => {
            useNetworkStore.getState().setNetwork('betanet')
            const { result } = renderScreenHook()
            expect(
                result.current.rows.find(row => row.isSelected)?.globalNetwork,
            ).toBe('testnet')

            await act(async () => {
                await result.current.selectNetwork('testnet')
            })

            expect(useNetworkStore.getState().network).toBe('testnet')
        })
    })

    describe('with two chains', () => {
        it('labels rows by tier and summarises the network each chain resolved to', () => {
            registerEthereum()
            useNetworkStore.getState().setGlobalNetwork('testnet')

            const { result } = renderScreenHook()

            expect(result.current.rows.map(row => row.label)).toEqual([
                'common.network_label.mainnet',
                'common.network_label.testnet',
                CUSTOM_LABEL,
            ])
            expect(result.current.chainNetworks).toEqual([
                {
                    chainId: 'algorand',
                    chainName: 'Algorand',
                    networkLabel: 'TestNet',
                    isMainnet: false,
                },
                {
                    chainId: ETHEREUM_CHAIN_ID,
                    chainName: 'Ethereum',
                    networkLabel: 'Sepolia',
                    isMainnet: false,
                },
            ])
        })

        it('labels a chain on a custom node as Custom', () => {
            registerEthereum(true)
            useNetworkStore.getState().setNetwork('custom')

            const { result } = renderScreenHook()

            expect(
                result.current.chainNetworks.map(chain => chain.networkLabel),
            ).toEqual([
                'common.network_label.custom',
                'common.network_label.custom',
            ])
        })
    })

    describe('the Custom row', () => {
        it('is hidden when no registered chain supports custom networks', () => {
            getProvider().chains.reset()
            registerEthereum(false)

            const { result } = renderScreenHook()

            expect(result.current.rows.map(row => row.globalNetwork)).toEqual([
                'mainnet',
                'testnet',
            ])
        })

        it('is hidden when the build does not offer custom networks', () => {
            mocks.isCustomNetworkOffered.mockReturnValue(false)

            const { result } = renderScreenHook()

            expect(result.current.rows.map(row => row.globalNetwork)).toEqual([
                'mainnet',
                'testnet',
            ])
        })

        it('requests the configuration sheet and writes nothing', async () => {
            const { result } = renderScreenHook()

            await act(async () => {
                await result.current.selectNetwork('custom')
            })

            expect(mocks.requestBottomSheet).toHaveBeenCalledOnce()
            expect(useNetworkStore.getState().globalNetwork).toBe('mainnet')
            expect(mocks.restart).not.toHaveBeenCalled()
        })
    })

    describe('selecting a row', () => {
        it('sets the global selection and restarts the sync', async () => {
            registerEthereum()
            const { result } = renderScreenHook()

            await act(async () => {
                await result.current.selectNetwork('testnet')
            })

            expect(useNetworkStore.getState().globalNetwork).toBe('testnet')
            expect(useNetworkStore.getState().network).toBe('testnet')
            expect(
                result.current.chainNetworks.find(
                    chain => chain.chainId === ETHEREUM_CHAIN_ID,
                )?.networkLabel,
            ).toBe('Sepolia')
            expect(mocks.restart).toHaveBeenCalledOnce()
        })

        it('still selects when the sync service is not initialized', async () => {
            mocks.getSyncService.mockImplementation(() => {
                throw new Error('SyncService not yet initialized')
            })
            const { result } = renderScreenHook()

            await act(async () => {
                await result.current.selectNetwork('testnet')
            })

            expect(useNetworkStore.getState().globalNetwork).toBe('testnet')
        })
    })

    it('shows the non-mainnet warning off MainNet only', async () => {
        const { result } = renderScreenHook()
        expect(result.current.isNonMainnetWarningVisible).toBe(false)

        await act(async () => {
            await result.current.selectNetwork('testnet')
        })

        expect(result.current.isNonMainnetWarningVisible).toBe(true)
    })
})
