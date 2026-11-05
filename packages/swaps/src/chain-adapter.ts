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
import type { Decimal } from 'decimal.js'
import {
    AppError,
    ErrorCategory,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { submitSignedGroup } from '@perawallet/wallet-core-signing'
import type {
    ExecuteSwapParams,
    ExecuteSwapResult,
    SwapExecutionContext,
} from './execution'
import type { SwapHistoryItem, SwapQuote } from './models'

/** What a swap costs on its source chain beyond the amount paid. */
export type SwapSourceCost = {
    /** Base units of the source chain's native asset; a ceiling, not a quote. */
    networkFee: Decimal
    /** Base units of the native asset the account is short by; null when it can pay. */
    shortfall: Nullable<Decimal>
    needsSpendApproval: boolean
    nativeSymbol: string
    nativeDecimals: number
}

/** Readies `address` to hold `assetId`; resolves false when the user declines. */
export type EnsureSwapReceivable = (params: {
    address: string
    scope: ChainScope
    assetId: string
}) => Promise<boolean>

/** The chain-specific legs of a swap; registered by the chain package. */
export interface SwapChainAdapter {
    chainId: ChainId
    /** The chain's native asset id: the default asset to pay with. */
    nativeAssetId: string
    /** The asset a swap receives until the user picks one. */
    defaultReceiveAssetId: string
    /** The swap router's id (CAIP-19) for one of this chain's assets on `scope`. */
    toRouterAssetId(assetId: string, scope: ChainScope): string
    /** Null for a router id this chain can't read as an asset on `scope`. */
    fromRouterAssetId(
        routerAssetId: string,
        scope: ChainScope,
    ): Nullable<string>
    /** Base units of the native asset held back when the user swaps a share of it. */
    maxAmountFeeReserve: Decimal
    /** Base units of the native asset a first holding of an asset locks; zero where holdings lock nothing. */
    holdingReserve(scope: ChainScope): Decimal
    /** Undefined when the item has nothing to link to or the network has no explorer. */
    swapExplorerUrl(scope: ChainScope, item: SwapHistoryItem): Optional<string>
    /** Null for a chain with nothing to show before the order. */
    estimateSourceCost(params: {
        quote: SwapQuote
        scope: ChainScope
    }): Promise<Nullable<SwapSourceCost>>
    /**
     * For a chain where an account must prepare to hold an asset. Runs while
     * the caller renders, so a swap paying out here can ready it first.
     */
    useEnsureReceivable?: () => EnsureSwapReceivable
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

/** The selected account is on no chain that has swap switched on. */
export class SwapAccountUnsupportedError extends AppError {
    constructor() {
        super('The selected account cannot swap on any chain.', {
            category: ErrorCategory.TRANSACTIONS,
            recoverable: false,
        })
        this.name = 'SwapAccountUnsupportedError'
    }
}

export const swapChainAdapters =
    createChainAdapterRegistry<SwapChainAdapter>('swap')

export const isSwapChain = (chainId: ChainId): boolean =>
    swapChainAdapters.has(chainId)

export const swapAdapterFor = (scope: ChainScope): SwapChainAdapter =>
    swapChainAdapters.get(scope.chainId)

export const swapExplorerUrlFor = (
    scope: ChainScope,
    item: SwapHistoryItem,
): Optional<string> => swapAdapterFor(scope).swapExplorerUrl(scope, item)

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
