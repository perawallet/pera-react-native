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
import {
    nodeEndpointAdapters,
    selectEndpointOverride,
    useNetworkStore,
    getSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    allCapabilities,
    ETHEREUM_CHAIN_ID,
    fixtureEthereumDescriptor,
} from '@test-utils/chain-fixtures'
import { useSettingsDeveloperNodeSettingsScreen } from '../useSettingsDeveloperNodeSettingsScreen'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

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

// Echoes the key, with the interpolated network when there is one, so the
// default label can be told apart from a plain display name.
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: { network?: string }) =>
            options ? `${key}(${options.network})` : key,
    }),
}))

const ALGORAND_ENDPOINTS: Record<string, string> = {
    testnet: 'https://testnet-api.algonode.example',
    betanet: 'https://betanet-api.algonode.example/v2?token=secret',
}
const SEPOLIA_RPC = 'https://sepolia.rpc.example/v3/key'

const registerAlgorandEndpoints = () =>
    nodeEndpointAdapters.register({
        chainId: LEGACY_CHAIN_ID,
        endpointUrl: networkId => ALGORAND_ENDPOINTS[networkId],
    })

// Reads the store's override the way the real adapter reads it through the chain context.
const registerEthereumEndpoints = (endpoints: Record<string, string>) =>
    nodeEndpointAdapters.register({
        chainId: ETHEREUM_CHAIN_ID,
        endpointUrl: networkId =>
            selectEndpointOverride(
                useNetworkStore.getState(),
                ETHEREUM_CHAIN_ID,
                networkId,
            ) ?? endpoints[networkId],
        checkOverride: vi.fn(async () => 'matches' as const),
    })

const DEFAULT_LABEL = 'settings.developer.node_settings.default_network_label'
const CUSTOM_LABEL = 'settings.developer.node_settings.custom_label'

// The fixture copies Algorand's family; Ethereum's UI is what the custom row reads.
const registerEthereum = (customNetworks = false) =>
    getProvider().chains.register(
        { ...fixtureEthereumDescriptor, family: 'evm' },
        {
            ...allCapabilities(false),
            customNetworks,
        },
    )

const renderScreenHook = () =>
    renderHook(() => useSettingsDeveloperNodeSettingsScreen())

const sectionFor = (
    result: ReturnType<typeof renderScreenHook>['result'],
    chainId: string,
) => result.current.chainSections.find(section => section.chainId === chainId)

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
        nodeEndpointAdapters.reset()
        registerAlgorandEndpoints()
    })

    it('is in live mode with no chain sections by default', () => {
        const { result } = renderScreenHook()

        expect(result.current.isDeveloperMode).toBe(false)
        expect(result.current.chainSections).toEqual([])
    })

    describe('turning developer mode on', () => {
        it('sets the mode and restarts sync once', () => {
            const { result } = renderScreenHook()

            act(() => result.current.setDeveloperMode(true))

            expect(useNetworkStore.getState().mode).toBe('developer')
            expect(result.current.isDeveloperMode).toBe(true)
            expect(mocks.restart).toHaveBeenCalledOnce()
        })

        it('still switches when the sync service is not initialized', () => {
            mocks.getSyncService.mockImplementation(() => {
                throw new Error('SyncService not yet initialized')
            })
            const { result } = renderScreenHook()

            act(() => result.current.setDeveloperMode(true))

            expect(useNetworkStore.getState().mode).toBe('developer')
        })

        it('lists the Algorand test networks with the default marked and selected, then Custom', () => {
            const { result } = renderScreenHook()

            act(() => result.current.setDeveloperMode(true))

            expect(sectionFor(result, 'algorand')?.networks).toEqual([
                {
                    networkId: 'testnet',
                    label: `${DEFAULT_LABEL}(TestNet)`,
                    isDefault: true,
                    isSelected: true,
                    endpointHost: 'testnet-api.algonode.example',
                    isEndpointOverridden: false,
                    canOverrideEndpoint: false,
                },
                {
                    networkId: 'betanet',
                    label: 'BetaNet',
                    isDefault: false,
                    isSelected: false,
                    endpointHost: 'betanet-api.algonode.example',
                    isEndpointOverridden: false,
                    canOverrideEndpoint: false,
                },
                {
                    networkId: 'custom',
                    label: CUSTOM_LABEL,
                    isDefault: false,
                    isSelected: false,
                    endpointHost: undefined,
                    isEndpointOverridden: false,
                    canOverrideEndpoint: false,
                },
            ])
        })

        it('lists only Ethereum active test networks, with no Custom row when its UI has no custom node form', () => {
            registerEthereum(true)
            const { result } = renderScreenHook()

            act(() => result.current.setDeveloperMode(true))

            expect(
                sectionFor(result, ETHEREUM_CHAIN_ID)?.networks.map(
                    network => network.networkId,
                ),
            ).toEqual(['sepolia'])
            expect(
                sectionFor(result, ETHEREUM_CHAIN_ID)?.networks[0],
            ).toMatchObject({
                label: `${DEFAULT_LABEL}(Sepolia)`,
                isDefault: true,
            })
        })
    })

    describe('the Custom row', () => {
        it('is hidden when the build does not offer custom networks', () => {
            mocks.isCustomNetworkOffered.mockReturnValue(false)
            const { result } = renderScreenHook()

            act(() => result.current.setDeveloperMode(true))

            expect(
                sectionFor(result, 'algorand')?.networks.map(
                    network => network.networkId,
                ),
            ).toEqual(['testnet', 'betanet'])
        })

        it('is hidden when no registered chain supports custom networks', () => {
            getProvider().chains.reset()
            registerEthereum(false)
            const { result } = renderScreenHook()

            act(() => result.current.setDeveloperMode(true))

            expect(
                result.current.chainSections.flatMap(section =>
                    section.networks.map(network => network.networkId),
                ),
            ).not.toContain('custom')
        })

        it('requests the configuration sheet and writes nothing', async () => {
            const { result } = renderScreenHook()
            act(() => result.current.setDeveloperMode(true))
            mocks.restart.mockClear()

            await act(async () => {
                await result.current.selectNetwork('algorand', 'custom')
            })

            expect(mocks.requestBottomSheet).toHaveBeenCalledOnce()
            const [request] = mocks.requestBottomSheet.mock.calls[0]
            expect(request.contents.props).toEqual({ chainId: 'algorand' })
            expect(useNetworkStore.getState().selectedNetworkByChain).toEqual(
                {},
            )
            expect(mocks.restart).not.toHaveBeenCalled()
        })

        it('opens nothing for a chain whose UI has no custom node form', async () => {
            registerEthereum(true)
            const { result } = renderScreenHook()
            act(() => result.current.setDeveloperMode(true))

            await act(async () => {
                await result.current.selectNetwork(ETHEREUM_CHAIN_ID, 'custom')
            })

            expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
            expect(useNetworkStore.getState().selectedNetworkByChain).toEqual(
                {},
            )
        })
    })

    describe('endpoints', () => {
        const ethereumRow = (
            result: ReturnType<typeof renderScreenHook>['result'],
        ) => sectionFor(result, ETHEREUM_CHAIN_ID)?.networks[0]

        it('lets a chain that checks overrides repoint a network it configures', () => {
            registerEthereum()
            registerEthereumEndpoints({ sepolia: SEPOLIA_RPC })
            const { result } = renderScreenHook()

            act(() => result.current.setDeveloperMode(true))

            expect(ethereumRow(result)).toMatchObject({
                endpointHost: 'sepolia.rpc.example',
                isEndpointOverridden: false,
                canOverrideEndpoint: true,
            })
        })

        it('offers no override for a network the chain has no endpoint for', () => {
            registerEthereum()
            registerEthereumEndpoints({})
            const { result } = renderScreenHook()

            act(() => result.current.setDeveloperMode(true))

            expect(ethereumRow(result)).toMatchObject({
                endpointHost: undefined,
                canOverrideEndpoint: false,
            })
        })

        it('shows a saved override on its row only', () => {
            registerEthereum()
            registerEthereumEndpoints({ sepolia: SEPOLIA_RPC })
            const { result } = renderScreenHook()
            act(() => result.current.setDeveloperMode(true))

            act(() =>
                useNetworkStore
                    .getState()
                    .setEndpointOverride(
                        ETHEREUM_CHAIN_ID,
                        'sepolia',
                        'http://localhost:8545',
                    ),
            )

            expect(ethereumRow(result)).toMatchObject({
                endpointHost: 'localhost:8545',
                isEndpointOverridden: true,
            })
            expect(
                sectionFor(result, 'algorand')?.networks.some(
                    network => network.isEndpointOverridden,
                ),
            ).toBe(false)
        })

        it('shows no endpoint for a chain with no endpoint adapter', () => {
            registerEthereum()
            const { result } = renderScreenHook()

            act(() => result.current.setDeveloperMode(true))

            expect(ethereumRow(result)?.endpointHost).toBeUndefined()
        })

        it('opens the override sheet for the network', async () => {
            const { result } = renderScreenHook()

            await act(async () => {
                await result.current.openEndpointOverride(
                    ETHEREUM_CHAIN_ID,
                    'sepolia',
                )
            })

            expect(mocks.requestBottomSheet).toHaveBeenCalledOnce()
            const [request] = mocks.requestBottomSheet.mock.calls[0]
            expect(request.contents.props).toEqual({
                chainId: ETHEREUM_CHAIN_ID,
                networkId: 'sepolia',
            })
            expect(request.options).toEqual({
                size: 'modal',
                autoCreateContainer: false,
            })
        })
    })

    describe('selecting a network', () => {
        it('selects BetaNet and restarts the sync', async () => {
            const { result } = renderScreenHook()
            act(() => result.current.setDeveloperMode(true))
            mocks.restart.mockClear()

            await act(async () => {
                await result.current.selectNetwork('algorand', 'betanet')
            })

            expect(getSelectedScope(LEGACY_CHAIN_ID).networkId).toBe('betanet')
            expect(
                sectionFor(result, 'algorand')?.networks.find(
                    network => network.isSelected,
                )?.networkId,
            ).toBe('betanet')
            expect(mocks.restart).toHaveBeenCalledOnce()
        })

        it('returns Algorand to the default by selecting TestNet again', async () => {
            const { result } = renderScreenHook()
            act(() => result.current.setDeveloperMode(true))
            await act(async () => {
                await result.current.selectNetwork('algorand', 'betanet')
            })

            await act(async () => {
                await result.current.selectNetwork('algorand', 'testnet')
            })

            expect(getSelectedScope(LEGACY_CHAIN_ID).networkId).toBe('testnet')
        })

        it('restores the BetaNet choice when developer mode goes off and on again', async () => {
            const { result } = renderScreenHook()
            act(() => result.current.setDeveloperMode(true))
            await act(async () => {
                await result.current.selectNetwork('algorand', 'betanet')
            })

            act(() => result.current.setDeveloperMode(false))
            expect(getSelectedScope(LEGACY_CHAIN_ID).networkId).toBe('mainnet')
            expect(result.current.chainSections).toEqual([])

            act(() => result.current.setDeveloperMode(true))
            expect(getSelectedScope(LEGACY_CHAIN_ID).networkId).toBe('betanet')
        })
    })
})
