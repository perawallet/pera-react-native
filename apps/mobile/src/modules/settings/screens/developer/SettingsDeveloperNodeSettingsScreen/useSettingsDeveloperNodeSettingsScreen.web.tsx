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

import { useCallback, useMemo, useState } from 'react'
import { getSyncService } from '@perawallet/wallet-core-background'
import { useNetwork, useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { Networks, type Network } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CustomNetworkSheet } from './CustomNetworkSheet'

// Duplicated from the native hook on purpose: Metro/webpack resolve a bare
// `./useSettingsDeveloperNodeSettingsScreen` import to THIS `.web` file
// regardless of which module does the importing, so the native and web
// hooks can't safely share this via a direct cross-import between the two
// platform variants. `LABEL_KEYS` and `NetworkRow` still need duplicating.
type NetworkRow = {
    network: Network
    labelKey: string
    isSelected: boolean
}

const LABEL_KEYS: Record<Network, string> = {
    [Networks.mainnet]: 'settings.developer.node_settings.mainnet_label',
    [Networks.testnet]: 'settings.developer.node_settings.testnet_label',
    [Networks.betanet]: 'settings.developer.node_settings.betanet_label',
    [Networks.custom]: 'settings.developer.node_settings.custom_label',
}

// Explicit display order: MainNet first. Object.values(Networks) follows the
// declaration order in packages/config, which is testnet-first, and a screen's
// row order should not be hostage to an unrelated object literal's ordering.
const NETWORK_DISPLAY_ORDER: Network[] = [
    Networks.mainnet,
    Networks.testnet,
    Networks.betanet,
    Networks.custom,
]

type UseSettingsDeveloperNodeSettingsScreenResult = {
    networks: NetworkRow[]
    isSwitching: boolean
    selectNetwork: (network: Network) => Promise<void>
    /** Non-MainNet networks are not fully supported — see the screen's callout. */
    isNonMainnetWarningVisible: boolean
}

// Web/extension variant: no backend device registration (that's native-only
// push-notification plumbing, irrelevant and failure-prone here). Selecting
// one of the three real networks is just persisting the store and nudging
// the sync service, so this hook tracks its own `isSwitching` flag directly
// rather than delegating to useSwitchNetwork like the native hook does.
// Custom never goes through this local switch path at all — see
// useCustomNetworkSheet's handleSave, the sheet's own commit point.
export const useSettingsDeveloperNodeSettingsScreen =
    (): UseSettingsDeveloperNodeSettingsScreenResult => {
        const { network: activeNetwork } = useNetwork()
        const [isSwitching, setIsSwitching] = useState(false)
        const { request } = useBottomSheet()

        const networks = useMemo(
            () =>
                NETWORK_DISPLAY_ORDER.map<NetworkRow>(network => ({
                    network,
                    labelKey: LABEL_KEYS[network],
                    isSelected: network === activeNetwork,
                })),
            [activeNetwork],
        )

        const selectNetwork = useCallback(
            async (network: Network): Promise<void> => {
                // Custom has no baked endpoints and is never switched to
                // directly — tapping it opens the config sheet instead
                // (checked before the same-network shortcut below, since
                // that's also how an already-configured custom network gets
                // reviewed/edited: there is no other entry point into the
                // sheet). The sheet owns its own commit, so the result is
                // ignored.
                if (network === Networks.custom) {
                    await request({
                        contents: <CustomNetworkSheet />,
                        options: { size: 'modal', autoCreateContainer: false },
                    })
                    return
                }

                if (network === activeNetwork) {
                    return
                }

                setIsSwitching(true)
                useNetworkStore.getState().setNetwork(network)

                try {
                    const syncService = getSyncService()
                    syncService.invalidateQueries()
                    syncService.restart()
                } catch {
                    // SyncService not yet initialized
                }

                setIsSwitching(false)
            },
            [activeNetwork, request],
        )

        return {
            networks,
            isSwitching,
            selectNetwork,
            isNonMainnetWarningVisible: activeNetwork !== Networks.mainnet,
        }
    }
