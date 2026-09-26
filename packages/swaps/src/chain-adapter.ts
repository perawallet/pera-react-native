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
import type {
    ExecuteSwapParams,
    ExecuteSwapResult,
    SwapExecutionContext,
} from './execution'

/** The chain-specific legs of a swap; registered by the chain package. */
export interface SwapChainAdapter {
    chainId: ChainId
    /**
     * Validates, signs and broadcasts the backend-prepared swap for a quote.
     * Returns every expected failure as a result rather than throwing.
     */
    executeSwap(
        params: ExecuteSwapParams,
        context: SwapExecutionContext,
    ): Promise<ExecuteSwapResult>
    /**
     * Broadcasts a group the shared-account handoff finished co-signing.
     * Resolves to the chain's transaction ids.
     */
    submitSignedGroup(
        network: Network,
        signedTransactions: Uint8Array[],
    ): Promise<string[]>
}

export const swapChainAdapters =
    createChainAdapterRegistry<SwapChainAdapter>('swap')

// Every legacy `Network` belongs to one chain; chain-contract owns that mapping.
export const swapAdapterFor = (network: Network): SwapChainAdapter =>
    swapChainAdapters.get(scopeForLegacyNetwork(network).chainId)
