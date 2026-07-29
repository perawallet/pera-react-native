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
import {
    useNetwork,
    useNetworkStore,
    useNodeOverrideStore,
    type NodeEndpointOverride,
} from '@perawallet/wallet-core-blockchain'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { Networks, type Network } from '@perawallet/wallet-core-shared'
import { isValidEndpoint } from './isValidEndpoint'

type NetworkRow = {
    network: Network
    labelKey: string
    isSelected: boolean
    algodUrl: string
    indexerUrl: string
    isOverridden: boolean
}

// Duplicated from the native hook on purpose: Metro/webpack resolve a bare
// `./useSettingsDeveloperNodeSettingsScreen` import to THIS `.web` file
// regardless of which module does the importing, so the native and web
// hooks can't safely share this via a direct cross-import between the two
// platform variants. `isValidEndpoint` no longer has this problem — it
// moved to the platform-neutral `./isValidEndpoint`, which has no `.web`
// twin — but `LABEL_KEYS` and `NetworkRow` still do.
const LABEL_KEYS: Record<Network, string> = {
    [Networks.mainnet]: 'settings.developer.node_settings.mainnet_label',
    [Networks.testnet]: 'settings.developer.node_settings.testnet_label',
    [Networks.betanet]: 'settings.developer.node_settings.betanet_label',
    [Networks.fnet]: 'settings.developer.node_settings.fnet_label',
    [Networks.localnet]: 'settings.developer.node_settings.localnet_label',
}

type UseSettingsDeveloperNodeSettingsScreenResult = {
    networks: NetworkRow[]
    isSwitching: boolean
    selectNetwork: (network: Network) => Promise<void>
    saveEndpoints: (network: Network, endpoints: NodeEndpointOverride) => void
    resetEndpoints: (network: Network) => void
}

// Web/extension variant: no backend device registration (that's native-only
// push-notification plumbing, irrelevant and failure-prone here). Selecting
// a network is just persisting the store and nudging the sync service, so
// this hook tracks its own `isSwitching` flag directly rather than
// delegating to useSwitchNetwork like the native hook does.
export const useSettingsDeveloperNodeSettingsScreen =
    (): UseSettingsDeveloperNodeSettingsScreenResult => {
        const { network: activeNetwork } = useNetwork()
        const [isSwitching, setIsSwitching] = useState(false)
        const overrides = useNodeOverrideStore(state => state.overrides)
        const setOverride = useNodeOverrideStore(state => state.setOverride)
        const clearOverride = useNodeOverrideStore(state => state.clearOverride)

        const networks = useMemo(
            () =>
                Object.values(Networks).map<NetworkRow>(network => {
                    const baked = getNetworkConfig(network)
                    const override = overrides[network]

                    return {
                        network,
                        labelKey: LABEL_KEYS[network],
                        isSelected: network === activeNetwork,
                        algodUrl: override?.algodUrl ?? baked.algodUrl,
                        indexerUrl: override?.indexerUrl ?? baked.indexerUrl,
                        isOverridden: override !== undefined,
                    }
                }),
            [activeNetwork, overrides],
        )

        const selectNetwork = useCallback(
            async (network: Network): Promise<void> => {
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
            [activeNetwork],
        )

        const saveEndpoints = useCallback(
            (network: Network, endpoints: NodeEndpointOverride) => {
                const cleaned: NodeEndpointOverride = {}
                if (
                    endpoints.algodUrl !== undefined &&
                    isValidEndpoint(endpoints.algodUrl)
                ) {
                    cleaned.algodUrl = endpoints.algodUrl
                }
                if (
                    endpoints.indexerUrl !== undefined &&
                    isValidEndpoint(endpoints.indexerUrl)
                ) {
                    cleaned.indexerUrl = endpoints.indexerUrl
                }
                // A malformed URL must not be persisted — it would leave the
                // network unreachable with no way back except a reinstall.
                if (Object.keys(cleaned).length === 0) return

                setOverride(network, cleaned)
            },
            [setOverride],
        )

        const resetEndpoints = useCallback(
            (network: Network) => clearOverride(network),
            [clearOverride],
        )

        return {
            networks,
            isSwitching,
            selectNetwork,
            saveEndpoints,
            resetEndpoints,
        }
    }
