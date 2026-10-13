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
    type ChainCapabilityRequirement,
    useChainCapabilityCheck,
    useSelectedChainMode,
} from '@perawallet/wallet-core-chain-shared'
import {
    isRestrictedIn,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import {
    routeCapabilities,
    routeCapabilityRestrictions,
    type RouteCapability,
} from '@routes/capabilities'

export type CapabilityRequirement = ChainCapabilityRequirement & {
    platform?: RouteCapability
}

/** A checker over one subscription, for a list of requirements or one chosen at call time. */
export const useCapabilityCheck = (): ((
    requirement: CapabilityRequirement,
) => boolean) => {
    const checkChain = useChainCapabilityCheck()
    // The active chain is Algorand while it is the only registered chain.
    const mode = useSelectedChainMode(LEGACY_CHAIN_ID)
    return ({ platform, ...chainRequirement }) =>
        checkChain(chainRequirement) &&
        (platform === undefined ||
            (routeCapabilities[platform] &&
                !isRestrictedIn(routeCapabilityRestrictions, platform, mode)))
}

/** True when every present part holds. A false capability hides; nothing renders disabled. */
export const useCapability = (requirement: CapabilityRequirement): boolean =>
    useCapabilityCheck()(requirement)
