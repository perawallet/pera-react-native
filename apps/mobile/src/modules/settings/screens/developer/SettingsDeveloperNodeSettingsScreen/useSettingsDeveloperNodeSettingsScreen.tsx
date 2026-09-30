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
    defaultNetworkForTier,
    GLOBAL_NETWORKS,
    type ChainId,
    type GlobalNetwork,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useAnyEnabledChainHasCapability,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useLanguage } from '@hooks/useLanguage'
import { useNetworkLabel } from '@hooks/useNetworkLabel'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CustomNetworkSheet } from './CustomNetworkSheet'
import { isCustomNetworkOffered } from './isCustomNetworkOffered'

export type NodeSettingsRowModel = {
    globalNetwork: GlobalNetwork
    label: string
    isSelected: boolean
}

export type ChainNetworkSummary = {
    chainId: ChainId
    chainName: string
    networkLabel: string
    isMainnet: boolean
}

type UseSettingsDeveloperNodeSettingsScreenResult = {
    rows: NodeSettingsRowModel[]
    /** Empty with one chain, where the row labels already name its networks. */
    chainNetworks: ChainNetworkSummary[]
    selectNetwork: (globalNetwork: GlobalNetwork) => Promise<void>
    isNonMainnetWarningVisible: boolean
}

export const useSettingsDeveloperNodeSettingsScreen =
    (): UseSettingsDeveloperNodeSettingsScreenResult => {
        const { t } = useLanguage()
        const networkLabel = useNetworkLabel()
        const { request } = useBottomSheet()
        const globalNetwork = useNetworkStore(state => state.globalNetwork)
        const selectedNetworkByChain = useNetworkStore(
            state => state.selectedNetworkByChain,
        )
        const setGlobalNetwork = useNetworkStore(
            state => state.setGlobalNetwork,
        )
        const hasCustomNetworks =
            useAnyEnabledChainHasCapability('customNetworks')
        // Registered once at bootstrap, before any screen mounts.
        const descriptors = useMemo(() => getProvider().chains.list(), [])
        const onlyChain = descriptors.length === 1 ? descriptors[0] : undefined

        const rows = useMemo(() => {
            const labelFor = (option: GlobalNetwork): string => {
                if (option === 'custom') {
                    return t('settings.developer.node_settings.custom_label')
                }
                const network =
                    onlyChain && defaultNetworkForTier(onlyChain, option)
                return network
                    ? t('settings.developer.node_settings.network_label', {
                          chain: onlyChain.displayName,
                          network: network.displayName,
                      })
                    : networkLabel(option)
            }
            const isCustomOffered =
                hasCustomNetworks && isCustomNetworkOffered()
            return GLOBAL_NETWORKS.filter(
                option => option !== 'custom' || isCustomOffered,
            ).map<NodeSettingsRowModel>(option => ({
                globalNetwork: option,
                label: labelFor(option),
                isSelected: option === globalNetwork,
            }))
        }, [hasCustomNetworks, onlyChain, globalNetwork, t, networkLabel])

        const chainNetworks = useMemo(() => {
            if (descriptors.length < 2) {
                return []
            }
            return descriptors.map<ChainNetworkSummary>(descriptor => {
                const networkId = selectChainNetworkId(
                    { globalNetwork, selectedNetworkByChain },
                    descriptor.id,
                )
                const network = descriptor.networks.find(
                    candidate => candidate.id === networkId,
                )
                return {
                    chainId: descriptor.id,
                    chainName: descriptor.displayName,
                    // A custom node has no descriptor entry to name it.
                    networkLabel:
                        network?.displayName ?? networkLabel(networkId),
                    isMainnet: network?.tier === 'mainnet',
                }
            })
        }, [descriptors, globalNetwork, selectedNetworkByChain, networkLabel])

        const selectNetwork = useCallback(
            async (option: GlobalNetwork) => {
                // Custom has no baked endpoints: the sheet is the only path
                // that commits it (see useCustomNetworkSheet's handleSave).
                if (option === 'custom') {
                    await request({
                        contents: <CustomNetworkSheet />,
                        options: { size: 'modal', autoCreateContainer: false },
                    })
                    return
                }

                // No same-row shortcut: re-selecting TestNet is how a wallet
                // pinned to BetaNet gets back onto TestNet.
                setGlobalNetwork(option)
                try {
                    // Invalidation is owned by the shell's network effect;
                    // calling it here too would double-refetch every query.
                    getSyncService().restart()
                } catch {
                    // SyncService not yet initialized
                }
            },
            [request, setGlobalNetwork],
        )

        return {
            rows,
            chainNetworks,
            selectNetwork,
            isNonMainnetWarningVisible: globalNetwork !== 'mainnet',
        }
    }
