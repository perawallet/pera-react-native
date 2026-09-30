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
import type { ChainId, NetworkId } from '@perawallet/wallet-core-chain-contract'
import {
    CUSTOM_NETWORK_ID,
    useChainCapability,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useSelectedChainNetwork } from '@hooks/useSelectedChainNetwork'
import { CustomNetworkSheet } from './CustomNetworkSheet'
import { isCustomNetworkOffered } from './isCustomNetworkOffered'

export type ChainNetworkRow = {
    networkId: NetworkId
    label: string
    isSelected: boolean
}

type UseChainNetworkPickerResult = {
    displayName: string
    networks: ChainNetworkRow[]
    selectNetwork: (networkId: NetworkId) => Promise<void>
    /** Non-MainNet networks are not fully supported: see the picker's callout. */
    isNonMainnet: boolean
    selectedLabel: string
}

export const useChainNetworkPicker = (
    chainId: ChainId,
): UseChainNetworkPickerResult => {
    const { t } = useLanguage()
    const { request } = useBottomSheet()
    const selectChainNetwork = useNetworkStore(state => state.selectNetwork)
    const isCustomNetworkEnabled = useChainCapability(chainId, 'customNetworks')
    const selected = useSelectedChainNetwork(chainId)
    const { descriptor } = getProvider().chains.get(chainId)
    const isCustomOffered = isCustomNetworkEnabled && isCustomNetworkOffered()

    const networks = useMemo(() => {
        const rows = descriptor.networks
            .filter(network => network.status === 'active')
            .map<ChainNetworkRow>(network => ({
                networkId: network.id,
                label: t('settings.developer.node_settings.network_label', {
                    chain: descriptor.displayName,
                    network: network.displayName,
                }),
                isSelected: network.id === selected.networkId,
            }))
        if (isCustomOffered) {
            rows.push({
                networkId: CUSTOM_NETWORK_ID,
                label: t('settings.developer.node_settings.custom_label'),
                isSelected: selected.networkId === CUSTOM_NETWORK_ID,
            })
        }
        return rows
    }, [descriptor, isCustomOffered, selected.networkId, t])

    const selectNetwork = useCallback(
        async (networkId: NetworkId) => {
            // Custom has no baked endpoints to switch to: tapping it opens the
            // config sheet, whose save is the only path that commits `custom`
            // as the active network, so this never writes the selection.
            if (networkId === CUSTOM_NETWORK_ID) {
                await request({
                    contents: <CustomNetworkSheet />,
                    options: { size: 'modal', autoCreateContainer: false },
                })
                return
            }

            if (networkId === selected.networkId) {
                return
            }

            selectChainNetwork(chainId, networkId)
            try {
                // Invalidation is owned by the shell's network effect: calling
                // it here too would double-refetch every mounted query.
                getSyncService().restart()
            } catch {
                // SyncService not yet initialized
            }
        },
        [chainId, request, selectChainNetwork, selected.networkId],
    )

    return {
        displayName: descriptor.displayName,
        networks,
        selectNetwork,
        isNonMainnet: !selected.isMainnet,
        selectedLabel: selected.label,
    }
}
