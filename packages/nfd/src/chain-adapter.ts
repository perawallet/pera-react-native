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
    scopeForLegacyNetwork,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Network } from '@perawallet/wallet-core-shared'
import type { NfdAddressVerification } from './models'

export type VerifyForwardResolutionParams = {
    name: string
    address: string
    scope: ChainScope
    signal?: AbortSignal
}

/** What the name service needs from a chain; registered by the chain package. */
export interface NameServiceChainAdapter {
    chainId: ChainId
    isValidAddress(address: string): boolean
    /**
     * Checks a backend-asserted `name` → `address` against the chain's own
     * record of the name. Must throw on abort and return `unavailable`, not a
     * verdict, when the chain cannot be read.
     */
    verifyForwardResolution?(
        params: VerifyForwardResolutionParams,
    ): Promise<NfdAddressVerification>
}

export const nameServiceChainAdapters =
    createChainAdapterRegistry<NameServiceChainAdapter>('name service')

// Every legacy `Network` belongs to one chain; chain-contract owns that mapping.
export const nameServiceAdapterFor = (
    network: Network,
): NameServiceChainAdapter =>
    nameServiceChainAdapters.get(scopeForLegacyNetwork(network).chainId)
