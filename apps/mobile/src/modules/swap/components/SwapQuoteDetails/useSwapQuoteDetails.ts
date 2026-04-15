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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { formatSwapRate } from '../../hooks/swapQuoteHelpers'

export type PriceImpactLevel = 'none' | 'low' | 'medium' | 'high'

type UseSwapQuoteDetailsResult = {
    rateDisplay: string
    priceImpactDisplay: string
    priceImpactLevel: PriceImpactLevel
    slippageDisplay: string
    peraFeeDisplay: string
    exchangeFeeDisplay: string
    providerDisplay: string
}

const PRICE_IMPACT_LOW_THRESHOLD = new Decimal(1)
const PRICE_IMPACT_HIGH_THRESHOLD = new Decimal(5)

const getPriceImpactLevel = (
    priceImpact: Decimal | null | undefined,
): PriceImpactLevel => {
    if (!priceImpact) return 'none'
    if (priceImpact.lessThan(PRICE_IMPACT_LOW_THRESHOLD)) return 'low'
    if (priceImpact.lessThan(PRICE_IMPACT_HIGH_THRESHOLD)) return 'medium'
    return 'high'
}

export const useSwapQuoteDetails = (
    quote: SwapQuote,
): UseSwapQuoteDetailsResult =>
    useMemo(
        () => ({
            rateDisplay: formatSwapRate(quote),
            priceImpactDisplay: quote.priceImpact
                ? `${quote.priceImpact.toDecimalPlaces(2).toString()}%`
                : '-',
            priceImpactLevel: getPriceImpactLevel(quote.priceImpact),
            slippageDisplay: quote.slippage
                ? `${quote.slippage.toString()}%`
                : '-',
            peraFeeDisplay: quote.peraFeeAmount
                ? formatAssetAmount(quote.peraFeeAmount, quote.assetIn)
                : '-',
            exchangeFeeDisplay: quote.exchangeFeeAmount
                ? formatAssetAmount(quote.exchangeFeeAmount, quote.assetIn)
                : '-',
            providerDisplay: quote.providerDisplayName ?? quote.provider ?? '-',
        }),
        [quote],
    )
