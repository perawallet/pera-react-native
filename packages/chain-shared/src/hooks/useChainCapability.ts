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

import type {
    ChainCapability,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useRemoteConfigOverrides } from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { selectChainMode, useNetworkStore } from '../store/network-store'

export type ChainCapabilityRequirement = {
    chain?: { chainId: ChainId; capability: ChainCapability }
    anyChain?: ChainCapability
}

/**
 * The one rendering rule for every capability gate: a false capability hides
 * the element that depends on it. Nothing is ever rendered disabled because
 * a capability is off, and no hook here checks whether the capability's
 * adapter is registered — that's a build-time concern the
 * capability-to-adapter parity test owns, not something the UI branches on.
 *
 * True when every present part holds; an empty requirement holds.
 */
export const useChainCapabilityRequirement = ({
    chain,
    anyChain,
}: ChainCapabilityRequirement): boolean => {
    // Feature Flags changes re-render through this subscription, and the
    // capabilities() reads below pick up whatever remote config holds then too.
    useRemoteConfigOverrides()
    // A primitive, so a gate re-renders only when some chain's mode changes
    // (mode, override or saved custom network), never on unrelated store writes.
    useNetworkStore(state =>
        getProvider()
            .chains.list()
            .map(({ id }) => `${id}:${selectChainMode(state, id)}`)
            .join(),
    )
    const { chains } = getProvider()
    return (
        (chain === undefined ||
            chains.capabilities(chain.chainId)[chain.capability]) &&
        (anyChain === undefined ||
            chains
                .list()
                .some(
                    descriptor => chains.capabilities(descriptor.id)[anyChain],
                ))
    )
}

export const useChainCapability = (
    chainId: ChainId,
    capability: ChainCapability,
): boolean => useChainCapabilityRequirement({ chain: { chainId, capability } })

export const useAnyEnabledChainHasCapability = (
    capability: ChainCapability,
): boolean => useChainCapabilityRequirement({ anyChain: capability })
