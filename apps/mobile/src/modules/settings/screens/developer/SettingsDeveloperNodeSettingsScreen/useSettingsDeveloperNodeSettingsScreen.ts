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
import {
    useCustomNetworkSheet,
    type UseCustomNetworkSheetResult,
} from './useCustomNetworkSheet'

export type NetworkRow = {
    network: Network
    labelKey: string
    isSelected: boolean
}

// Static keys: pnpm lint:i18n cannot verify an interpolated key.
const LABEL_KEYS: Record<Network, string> = {
    [Networks.mainnet]: 'settings.developer.node_settings.mainnet_label',
    [Networks.testnet]: 'settings.developer.node_settings.testnet_label',
    [Networks.betanet]: 'settings.developer.node_settings.betanet_label',
    [Networks.custom]: 'settings.developer.node_settings.custom_label',
}

type UseSettingsDeveloperNodeSettingsScreenResult = {
    networks: NetworkRow[]
    selectNetwork: (network: Network) => Promise<void>
    sheet: UseCustomNetworkSheetResult
}

export const useSettingsDeveloperNodeSettingsScreen =
    (): UseSettingsDeveloperNodeSettingsScreenResult => {
        const { network: activeNetwork } = useNetwork()
        const { switchNetwork } = useSwitchNetwork()
        const sheet = useCustomNetworkSheet()

        const networks = useMemo(
            () =>
                Object.values(Networks).map<NetworkRow>(network => ({
                    network,
                    labelKey: LABEL_KEYS[network],
                    isSelected: network === activeNetwork,
                })),
            [activeNetwork],
        )

        const selectNetwork = useCallback(
            async (network: Network) => {
                // Custom has no baked endpoints to switch to — tapping it
                // opens the config sheet instead, which is the only path
                // that can ever commit `custom` as the active network (see
                // useCustomNetworkSheet's handleSave). This never switches.
                if (network === Networks.custom) {
                    sheet.open()
                    return
                }

                // Offline-safe local write; device registration is deferred
                // (see useSwitchNetwork). Nothing to toast about.
                await switchNetwork(network)
                try {
                    const syncService = getSyncService()
                    syncService.invalidateQueries()
                    syncService.restart()
                } catch {
                    // SyncService not yet initialized
                }
            },
            [switchNetwork, sheet],
        )

        return { networks, selectNetwork, sheet }
    }
