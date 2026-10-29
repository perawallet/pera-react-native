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
    createChainAdapterRegistry,
    type ChainEndpoints,
    type ChainId,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

export type EndpointOverrideCheck = 'matches' | 'wrong-network' | 'unreachable'

/** Full base URLs a developer pointed a chain's networks at, keyed by network id. */
export type EndpointOverrides = Readonly<Partial<Record<NetworkId, string>>>

/** Where a chain's node requests go, and whether a developer may repoint them. */
export interface NodeEndpointAdapter {
    readonly chainId: ChainId
    /** The URL the network's requests use now, override included; `undefined` when none is configured. */
    endpointUrl(networkId: NetworkId): Optional<string>
    /** Present only on chains that accept an override. Never rejects: a failed request resolves `'unreachable'`. */
    checkOverride?(
        networkId: NetworkId,
        url: string,
    ): Promise<EndpointOverrideCheck>
}

export const nodeEndpointAdapters =
    createChainAdapterRegistry<NodeEndpointAdapter>('node endpoint')

// Only keys the chain already configures are replaced, so an override can
// repoint a network but never add one.
export const withEndpointOverrides = (
    configured: ChainEndpoints,
    overrides: Optional<EndpointOverrides>,
): ChainEndpoints => {
    if (!overrides) return configured
    return Object.fromEntries(
        Object.entries(configured).map(([networkId, url]) => [
            networkId,
            overrides[networkId as NetworkId] ?? url,
        ]),
    )
}
