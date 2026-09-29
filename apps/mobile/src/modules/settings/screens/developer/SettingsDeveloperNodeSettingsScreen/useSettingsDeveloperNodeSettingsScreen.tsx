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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useSwitchNetwork } from '@perawallet/wallet-core-device'
import { Networks, type Network } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CustomNetworkSheet } from './CustomNetworkSheet'

export type NetworkRow = {
    network: Network
    labelKey: string
    isSelected: boolean
}

// Explicit display order: MainNet first. Object.values(Networks) follows the
// declaration order in packages/config, which is testnet-first, and a screen's
// row order should not be hostage to an unrelated object literal's ordering.
// Static keys: the i18n lint rules cannot verify an interpolated key.
const NETWORK_ROWS: readonly { network: Network; labelKey: string }[] = [
    {
        network: Networks.mainnet,
        labelKey: 'settings.developer.node_settings.mainnet_label',
    },
    {
        network: Networks.testnet,
        labelKey: 'settings.developer.node_settings.testnet_label',
    },
    {
        network: Networks.betanet,
        labelKey: 'settings.developer.node_settings.betanet_label',
    },
    {
        network: Networks.custom,
        labelKey: 'settings.developer.node_settings.custom_label',
    },
]

type UseSettingsDeveloperNodeSettingsScreenResult = {
    networks: NetworkRow[]
    selectNetwork: (network: Network) => Promise<void>
    /** Non-MainNet networks are not fully supported — see the screen's callout. */
    isNonMainnetWarningVisible: boolean
}

export const useSettingsDeveloperNodeSettingsScreen =
    (): UseSettingsDeveloperNodeSettingsScreenResult => {
        const { network: activeNetwork } = useNetwork()
        const { switchNetwork } = useSwitchNetwork()
        const { request } = useBottomSheet()

        const networks = useMemo(
            () =>
                NETWORK_ROWS.map<NetworkRow>(row => ({
                    ...row,
                    isSelected: row.network === activeNetwork,
                })),
            [activeNetwork],
        )

        const selectNetwork = useCallback(
            async (network: Network) => {
                // Custom has no baked endpoints to switch to — tapping it
                // opens the config sheet instead, which is the only path
                // that can ever commit `custom` as the active network (see
                // useCustomNetworkSheet's handleSave). This never switches.
                // The sheet owns its own commit, so the result is ignored.
                if (network === Networks.custom) {
                    await request({
                        contents: <CustomNetworkSheet />,
                        options: { size: 'modal', autoCreateContainer: false },
                    })
                    return
                }

                // Offline-safe local write; device registration is deferred
                // (see useSwitchNetwork). Nothing to toast about.
                await switchNetwork(network)
                try {
                    // Invalidation is owned by RootComponent's network effect —
                    // calling it here too would double-refetch every mounted query.
                    getSyncService().restart()
                } catch {
                    // SyncService not yet initialized
                }
            },
            [switchNetwork, request],
        )

        return {
            networks,
            selectNetwork,
            isNonMainnetWarningVisible: activeNetwork !== Networks.mainnet,
        }
    }
