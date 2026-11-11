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
    defaultNetworkForTier,
    type ChainDescriptor,
    type ChainFamily,
    type ChainId,
    type ChainNetwork,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

// Total per family, so a new family fails type-checking until handled.
// Discover's EVM directory is curated per chain, so EVM always sends mainnet.
const DISCOVER_NETWORK_OF: Record<
    ChainFamily,
    (d: ChainDescriptor, selected: NetworkId) => Optional<ChainNetwork>
> = {
    algorand: (d, selected) => d.networks.find(n => n.id === selected),
    evm: d => defaultNetworkForTier(d, 'mainnet'),
}

export const discoverCaip2Of = (
    chainId: ChainId,
    networkId: NetworkId,
): Nullable<string> => {
    const descriptor = getChainDescriptor(chainId)
    return (
        DISCOVER_NETWORK_OF[descriptor.family](descriptor, networkId)?.caip2 ??
        null
    )
}
