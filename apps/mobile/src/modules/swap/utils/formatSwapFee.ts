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
    assetRefKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    formatAssetAmount,
    nativeAssetFor,
} from '@perawallet/wallet-core-assets'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    swapFeeOf,
    type SwapFeeKind,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'

/**
 * Null when the quote has no such fee, or charges it in an asset that is
 * neither a leg nor the chain's native coin, whose decimals aren't known here.
 * `scope` limits it to a fee charged there.
 */
export const formatSwapFee = (
    quote: SwapQuote,
    kind: SwapFeeKind,
    scope?: ChainScope,
): Nullable<string> => {
    const fee = swapFeeOf(quote, kind, scope)
    if (!fee) return null
    const feeKey = assetRefKey(fee.asset)
    const asset = [quote.assetIn, quote.assetOut].find(
        leg => assetRefKey(leg.ref) === feeKey,
    )
    if (asset) return formatAssetAmount(fee.amount, asset)
    const native = nativeAssetFor(fee.asset.chainId)
    return native.assetId === fee.asset.assetId
        ? formatAssetAmount(fee.amount, native)
        : null
}

/** The slippage the quote was requested with, in percent; '-' when the router chose it. */
export const formatSwapSlippage = (quote: SwapQuote): string =>
    quote.request.slippage ? `${quote.request.slippage}%` : '-'
