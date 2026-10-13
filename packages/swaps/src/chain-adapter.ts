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
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'
import { submitSignedGroup } from '@perawallet/wallet-core-signing'
import type {
    ExecuteSwapParams,
    ExecuteSwapResult,
    SwapExecutionContext,
} from './execution'

/** The chain-specific legs of a swap; registered by the chain package. */
export interface SwapChainAdapter {
    chainId: ChainId
    /**
     * The chain's native asset id: what the swap backend's missing `asset_id`
     * stands for, and the default asset to pay with.
     */
    nativeAssetId: string
    /**
     * Validates, signs and broadcasts the backend-prepared swap for a quote.
     * Returns every expected failure as a result rather than throwing.
     */
    executeSwap(
        params: ExecuteSwapParams,
        context: SwapExecutionContext,
    ): Promise<ExecuteSwapResult>
    /**
     * Whether a shared-account handoff's co-signed group can finish here; the
     * chain's broadcaster submits it. Without it a shared-account swap is
     * refused, never sent unsigned.
     */
    supportsCosignedSwaps: boolean
}

export class SwapCosignUnsupportedError extends AppError {
    readonly chainId: ChainId

    constructor(chainId: ChainId) {
        super(`Shared-account swaps are not supported on ${chainId}.`, {
            category: ErrorCategory.TRANSACTIONS,
            recoverable: false,
        })
        this.name = 'SwapCosignUnsupportedError'
        this.chainId = chainId
    }
}

export const swapChainAdapters =
    createChainAdapterRegistry<SwapChainAdapter>('swap')

export const swapAdapterFor = (scope: ChainScope): SwapChainAdapter =>
    swapChainAdapters.get(scope.chainId)

/** Throws {@link SwapCosignUnsupportedError} when the chain can't finish a co-signed group. */
export const submitCosignedSwapGroup = (
    scope: ChainScope,
    signedTransactions: Uint8Array[],
): Promise<string[]> => {
    const adapter = swapAdapterFor(scope)
    if (!adapter.supportsCosignedSwaps) {
        return Promise.reject(new SwapCosignUnsupportedError(adapter.chainId))
    }
    return submitSignedGroup(scope, signedTransactions)
}
