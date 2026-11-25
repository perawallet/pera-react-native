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

import { Decimal } from 'decimal.js'

import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    DEFAULT_PRECISION,
    formatNumber,
    type Maybe,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { SwapQuote } from '../models'

// Display precision for a rate whose out asset came back without decimals.
const UNKNOWN_DECIMALS_RATE_PRECISION = 6

const RATE_SIGNIFICANT_DIGITS = 6

export const pickBestByAmountOut = (quotes: SwapQuote[]): Nullable<SwapQuote> =>
    quotes.reduce<Nullable<SwapQuote>>((prev, curr) => {
        if (!curr.amountOut) return prev
        if (!prev?.amountOut) return curr
        return curr.amountOut.greaterThan(prev.amountOut) ? curr : prev
    }, null)

export const sortQuotesByAmountOutDesc = (quotes: SwapQuote[]): SwapQuote[] =>
    [...quotes].sort((a, b) => {
        if (!a.amountOut && !b.amountOut) return 0
        if (!a.amountOut) return 1
        if (!b.amountOut) return -1
        if (a.amountOut.greaterThan(b.amountOut)) return -1
        if (b.amountOut.greaterThan(a.amountOut)) return 1
        return 0
    })

/** Display units of `assetOut` per one display unit of `assetIn`; null without both decimals. */
export const swapRate = (quote: SwapQuote): Nullable<Decimal> => {
    const inDecimals = quote.assetIn.decimals
    const outDecimals = quote.assetOut.decimals
    if (inDecimals === undefined || outDecimals === undefined) return null
    if (quote.amountIn.isZero()) return null
    return baseUnitsToDisplayUnits(quote.amountOut, outDecimals).div(
        baseUnitsToDisplayUnits(quote.amountIn, inDecimals),
    )
}

export const formatSwapRate = (quote: SwapQuote): string => {
    const rate = swapRate(quote)
    if (!rate) return '-'
    const outDecimals =
        quote.assetOut.decimals ?? UNKNOWN_DECIMALS_RATE_PRECISION
    // Significant digits keep a tiny rate readable, but never round the integer part.
    const decimals = Math.min(
        Math.max(
            rate.toSignificantDigits(RATE_SIGNIFICANT_DIGITS).decimalPlaces(),
            DEFAULT_PRECISION,
        ),
        outDecimals,
    )
    const { sign, integer, fraction } = formatNumber(
        rate,
        decimals,
        undefined,
        DEFAULT_PRECISION,
    )
    const inUnit = quote.assetIn.unitName ?? ''
    const outUnit = quote.assetOut.unitName ?? ''
    return `1 ${inUnit} ≈ ${sign}${integer}${fraction} ${outUnit}`
}

/** `quote` when it is for `assetId` on `scope` as its out asset; null otherwise. */
export const quoteForAssetOut = (
    quote: Maybe<SwapQuote>,
    scope: ChainScope,
    assetId: string,
): Nullable<SwapQuote> => {
    if (!quote) return null
    // Built here rather than via scopeOfSwapAsset: router-ids loads the chain
    // adapters, and this file stays importable on its own.
    const { chainId, networkId, assetId: outAssetId } = quote.assetOut.ref
    return outAssetId === assetId &&
        toScopeKey({ chainId, networkId }) === toScopeKey(scope)
        ? quote
        : null
}

/** USD per display unit of the out asset, as the router valued `amountOut`. */
export const quoteOutUsdPrice = (quote: SwapQuote): Optional<Decimal> => {
    if (!quote.amountOutUsdValue) return undefined
    const amountOut = baseUnitsToDisplayUnits(
        quote.amountOut,
        quote.assetOut.decimals ?? 0,
    )
    if (amountOut.isZero()) return undefined
    try {
        return new Decimal(quote.amountOutUsdValue).div(amountOut)
    } catch {
        return undefined
    }
}
