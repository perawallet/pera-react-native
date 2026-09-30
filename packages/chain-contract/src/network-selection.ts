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

import type { ChainDescriptor } from './models/descriptor'
import {
    CUSTOM_NETWORK_ID,
    type ChainNetwork,
    type GlobalNetwork,
    type NetworkId,
    type NetworkTier,
} from './models/identity'

export const defaultNetworkForTier = (
    descriptor: ChainDescriptor,
    tier: NetworkTier,
): ChainNetwork | undefined =>
    descriptor.networks.find(
        candidate => candidate.tier === tier && candidate.isDefaultForTier,
    )

const defaultForTier = (
    descriptor: ChainDescriptor,
    tier: NetworkTier,
): NetworkId => {
    const network = defaultNetworkForTier(descriptor, tier)
    if (!network) {
        throw new Error(
            `Chain "${descriptor.id}" has no default ${tier} network`,
        )
    }
    return network.id
}

/**
 * A chain without custom networks follows Custom onto its testnet: a custom
 * node is a test setup, and leaving that chain on mainnet beside it would mix
 * real and test funds in one wallet.
 */
export const networkIdForGlobal = (
    descriptor: ChainDescriptor,
    globalNetwork: GlobalNetwork,
    hasCustomNetworks: boolean,
): NetworkId => {
    if (globalNetwork !== 'custom') {
        return defaultForTier(descriptor, globalNetwork)
    }
    return hasCustomNetworks
        ? CUSTOM_NETWORK_ID
        : defaultForTier(descriptor, 'testnet')
}
