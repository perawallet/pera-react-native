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
    networkTierForMode,
    type ChainId,
    type ChainRegistry,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * The CAIP-2 id the devices API names the chain's network by on this
 * deployment. A deployment serves one tier, so it is that tier's default
 * network whatever network the user has selected.
 */
export const registrationChainOf = (
    chains: ChainRegistry,
    chainId: ChainId,
    deployment: WalletMode,
): Nullable<string> => {
    if (!chains.has(chainId)) return null
    return (
        defaultNetworkForTier(
            chains.get(chainId).descriptor,
            networkTierForMode(deployment),
        )?.caip2 ?? null
    )
}
