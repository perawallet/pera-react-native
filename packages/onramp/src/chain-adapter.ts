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
} from '@perawallet/wallet-core-chain-contract'
import type { Network } from '@perawallet/wallet-core-shared'
import type { RampToken } from './models'

/** How the ramp catalogue maps onto a chain; registered by the chain package. */
export interface RampChainAdapter {
    chainId: ChainId
    /** Catalogue ids of the tokens the ramp delivers on this chain. */
    destinationTokenIds: readonly string[]
    isNativeToken(token: Pick<RampToken, 'id' | 'symbol'>): boolean
    /** The on-chain asset id the token arrives as, as a decimal string. */
    toAssetId(token: Pick<RampToken, 'id' | 'symbol'>): string
}

export const rampChainAdapters =
    createChainAdapterRegistry<RampChainAdapter>('ramp')

export const rampAdapterFor = (network: Network): RampChainAdapter =>
    rampChainAdapters.get(scopeForLegacyNetwork(network).chainId)
