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

import { useCallback, useMemo } from 'react'
import { getSyncService } from '@perawallet/wallet-core-background'
import {
    CUSTOM_NETWORK_ID,
    LEGACY_CHAIN_ID,
    type ChainId,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useAnyEnabledChainHasCapability,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CustomNetworkSheet } from './CustomNetworkSheet'
import { isCustomNetworkOffered } from './isCustomNetworkOffered'

export type NodeSettingsNetworkRow = {
    networkId: NetworkId
    label: string
    isDefault: boolean
    isSelected: boolean
}

export type NodeSettingsChainSection = {
    chainId: ChainId
    chainName: string
    networks: NodeSettingsNetworkRow[]
}

type UseSettingsDeveloperNodeSettingsScreenResult = {
    isDeveloperMode: boolean
    setDeveloperMode: (isEnabled: boolean) => void
    /** Empty in live mode, where every chain is on its main network. */
    chainSections: NodeSettingsChainSection[]
    selectNetwork: (chainId: ChainId, networkId: NetworkId) => Promise<void>
}

const restartSync = () => {
    try {
        // Invalidation is owned by the shell's network effect;
        // calling it here too would double-refetch every query.
        getSyncService().restart()
    } catch {
        // SyncService not yet initialized
    }
}

export const useSettingsDeveloperNodeSettingsScreen =
    (): UseSettingsDeveloperNodeSettingsScreenResult => {
        const { t } = useLanguage()
        const { request } = useBottomSheet()
        const mode = useNetworkStore(state => state.mode)
        const selectedNetworkByChain = useNetworkStore(
            state => state.selectedNetworkByChain,
        )
        const customNetworksByChain = useNetworkStore(
            state => state.customNetworksByChain,
        )
        const setMode = useNetworkStore(state => state.setMode)
        const selectNetworkInStore = useNetworkStore(
            state => state.selectNetwork,
        )
        const hasCustomNetworks =
            useAnyEnabledChainHasCapability('customNetworks')
        const isDeveloperMode = mode === 'developer'

        const chainSections = useMemo<NodeSettingsChainSection[]>(() => {
            if (!isDeveloperMode) {
                return []
            }
            const { chains } = getProvider()
            const selection = {
                mode,
                selectedNetworkByChain,
                customNetworksByChain,
            }
            return chains.list().map(descriptor => {
                const selectedId = selectChainNetworkId(
                    selection,
                    descriptor.id,
                )
                const networks = descriptor.networks
                    .filter(
                        network =>
                            network.tier === 'testnet' &&
                            network.status === 'active',
                    )
                    .map<NodeSettingsNetworkRow>(network => ({
                        networkId: network.id,
                        label: network.isDefaultForTier
                            ? t(
                                  'settings.developer.node_settings.default_network_label',
                                  { network: network.displayName },
                              )
                            : network.displayName,
                        isDefault: network.isDefaultForTier,
                        isSelected: network.id === selectedId,
                    }))
                // ponytail: the sheet configures the legacy chain's single custom slot; give it a chainId when a second chain adds custom networks.
                if (
                    descriptor.id === LEGACY_CHAIN_ID &&
                    hasCustomNetworks &&
                    chains.capabilities(descriptor.id).customNetworks &&
                    isCustomNetworkOffered()
                ) {
                    networks.push({
                        networkId: CUSTOM_NETWORK_ID,
                        label: t(
                            'settings.developer.node_settings.custom_label',
                        ),
                        isDefault: false,
                        isSelected: selectedId === CUSTOM_NETWORK_ID,
                    })
                }
                return {
                    chainId: descriptor.id,
                    chainName: descriptor.displayName,
                    networks,
                }
            })
        }, [
            isDeveloperMode,
            mode,
            selectedNetworkByChain,
            customNetworksByChain,
            hasCustomNetworks,
            t,
        ])

        const setDeveloperMode = useCallback(
            (isEnabled: boolean) => {
                setMode(isEnabled ? 'developer' : 'live')
                restartSync()
            },
            [setMode],
        )

        const selectNetwork = useCallback(
            async (chainId: ChainId, networkId: NetworkId) => {
                // Custom has no baked endpoints: the sheet is the only path
                // that commits it (see useCustomNetworkSheet's handleSave).
                if (networkId === CUSTOM_NETWORK_ID) {
                    await request({
                        contents: <CustomNetworkSheet />,
                        options: { size: 'modal', autoCreateContainer: false },
                    })
                    return
                }

                selectNetworkInStore(chainId, networkId)
                restartSync()
            },
            [request, selectNetworkInStore],
        )

        return {
            isDeveloperMode,
            setDeveloperMode,
            chainSections,
            selectNetwork,
        }
    }
