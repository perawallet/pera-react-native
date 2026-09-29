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

/**
 * The one rendering rule for every capability gate: a false capability hides
 * the element that depends on it. Nothing is ever rendered disabled because
 * a capability is off, and neither hook here checks whether the capability's
 * adapter is registered — that's a build-time concern the
 * capability-to-adapter parity test owns, not something the UI branches on.
 */
export const useChainCapability = (
    chainId: ChainId,
    capability: ChainCapability,
): boolean => {
    // The developer Feature Flags layer is the only one that changes without
    // a remount; subscribing to it re-renders this hook so the capabilities()
    // read below picks up whatever remote config holds at that moment too.
    useRemoteConfigOverrides()
    return getProvider().chains.capabilities(chainId)[capability]
}

export const useAnyEnabledChainHasCapability = (
    capability: ChainCapability,
): boolean => {
    useRemoteConfigOverrides()
    const { chains } = getProvider()
    return chains
        .list()
        .some(descriptor => chains.capabilities(descriptor.id)[capability])
}
