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

import {
    CUSTOM_NETWORK_ID,
    LEGACY_CHAIN_ID,
    scopeForLegacyNetwork,
} from '@perawallet/wallet-core-chain-contract'
import {
    isCustomNetworkConfig,
    registerCustomNetworkSource,
    type CustomNetworkConfig,
} from '@perawallet/wallet-core-config'
import {
    selectCustomNetwork,
    useNetworkStore,
    type CustomNetwork,
} from '@perawallet/wallet-core-chain-shared'

export type AlgorandCustomNetwork = CustomNetwork & CustomNetworkConfig

/** Returns the stored entry itself, so it is a stable selector. */
export const selectAlgorandCustomNetwork = (
    state: Parameters<typeof selectCustomNetwork>[0],
): AlgorandCustomNetwork | undefined => {
    const entry = selectCustomNetwork(state, LEGACY_CHAIN_ID, CUSTOM_NETWORK_ID)
    return entry !== undefined && isCustomNetworkConfig(entry)
        ? entry
        : undefined
}

/** Non-hook read, for the client factories and resolvers that run outside React. */
export const getCustomNetworkConfig = (): AlgorandCustomNetwork | undefined =>
    selectAlgorandCustomNetwork(useNetworkStore.getState())

/**
 * The Custom radio is always tappable (it is the only route into the config
 * sheet), but `custom` must never become the active network until this is true.
 */
export const isCustomNetworkConfigured = (): boolean =>
    getCustomNetworkConfig() !== undefined

export const setCustomNetwork = (customConfig: CustomNetworkConfig): void =>
    useNetworkStore.getState().setCustomNetwork(LEGACY_CHAIN_ID, {
        ...customConfig,
        id: CUSTOM_NETWORK_ID,
    })

export const clearCustomNetwork = (): void =>
    useNetworkStore
        .getState()
        .clearCustomNetwork(LEGACY_CHAIN_ID, CUSTOM_NETWORK_ID)

// A literal, not Networks.custom: module load must not touch the config enum.
const CUSTOM_SCOPE = scopeForLegacyNetwork('custom')

// config resolves chain endpoints but cannot import the store, so the saved
// node reaches getChainConfig through this reader.
registerCustomNetworkSource(scope => {
    const saved = getCustomNetworkConfig()
    if (
        saved === undefined ||
        scope.chainId !== CUSTOM_SCOPE.chainId ||
        scope.networkId !== CUSTOM_SCOPE.networkId
    ) {
        return undefined
    }
    return {
        algodUrl: saved.algodUrl,
        indexerUrl: saved.indexerUrl,
        algodToken: saved.algodToken ?? '',
        indexerToken: saved.indexerToken ?? '',
        genesisHash: saved.genesisHash,
        genesisId: saved.genesisId,
    }
})
