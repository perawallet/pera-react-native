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

import type { ChainRegistry } from './chain-registry'
import { TEST_NETWORK_VALUE_COUNTS_IN_FIAT_TOTALS } from './fiat-totals-policy'
import type { ChainDescriptor } from './models/descriptor'
import type {
    ChainMode,
    ChainNetwork,
    ChainScope,
    NetworkId,
    NetworkTier,
    WalletMode,
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

/** Undefined for a network the descriptor doesn't list, such as a saved custom network. */
export const networkTierOf = (
    descriptor: ChainDescriptor,
    networkId: NetworkId,
): NetworkTier | undefined =>
    descriptor.networks.find(candidate => candidate.id === networkId)?.tier

/**
 * A custom network counts as test tier, since only developer mode can select
 * one. False for a chain the build doesn't register.
 */
export const isTestTierScope = (
    chains: ChainRegistry,
    scope: ChainScope,
): boolean =>
    chains.has(scope.chainId) &&
    networkTierOf(chains.get(scope.chainId).descriptor, scope.networkId) !==
        'mainnet'

/** The fiat-total decision; see docs/CHAINS.md, Test networks in totals. */
export const countsTowardFiatTotals = (
    chains: ChainRegistry,
    scope: ChainScope,
): boolean =>
    !isTestTierScope(chains, scope) || TEST_NETWORK_VALUE_COUNTS_IN_FIAT_TOTALS

export const networkTierForMode = (mode: WalletMode): NetworkTier =>
    mode === 'live' ? 'mainnet' : 'testnet'

/**
 * The caller validates `override`: custom networks are user data the
 * descriptor doesn't list.
 */
export const networkIdForMode = (
    descriptor: ChainDescriptor,
    mode: WalletMode,
    override?: NetworkId,
): NetworkId =>
    mode === 'live'
        ? defaultForTier(descriptor, 'mainnet')
        : (override ?? defaultForTier(descriptor, 'testnet'))

/**
 * The caller validates `override`, as for `networkIdForMode`. Never throws,
 * even for a descriptor with no default test network.
 */
export const chainModeFor = (
    descriptor: ChainDescriptor,
    mode: WalletMode,
    override?: NetworkId,
): ChainMode => {
    if (mode === 'live') {
        return 'live'
    }
    return override === undefined ||
        override === defaultNetworkForTier(descriptor, 'testnet')?.id
        ? 'developer'
        : 'developer-override'
}
