/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { formatNumber } from '@perawallet/wallet-core-shared'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'

const RATE_FALLBACK_DECIMALS = 6
const RATE_MIN_PRECISION = 2

export const pickBestByAmountOut = (quotes: SwapQuote[]): SwapQuote | null =>
    quotes.reduce<SwapQuote | null>((prev, curr) => {
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

export const formatSwapRate = (quote: SwapQuote): string => {
    if (!quote.price) return '-'
    const outDecimals = quote.assetOut.decimals ?? RATE_FALLBACK_DECIMALS
    const { sign, integer, fraction } = formatNumber(
        quote.price,
        outDecimals,
        undefined,
        RATE_MIN_PRECISION,
    )
    const inUnit = quote.assetIn.unitName ?? ''
    const outUnit = quote.assetOut.unitName ?? ''
    return `1 ${inUnit} ≈ ${sign}${integer}${fraction} ${outUnit}`
}
