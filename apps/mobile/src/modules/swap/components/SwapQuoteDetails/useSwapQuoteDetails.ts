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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import {
    apiSlippageToPercent,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { formatSwapRate } from '../../hooks/swapQuoteHelpers'
import type { Maybe } from '@perawallet/wallet-core-shared'

export type PriceImpactLevel = 'none' | 'low' | 'medium' | 'high'

type UseSwapQuoteDetailsResult = {
    rateDisplay: string
    priceImpactDisplay: string
    priceImpactLevel: PriceImpactLevel
    slippageDisplay: string
    peraFeeDisplay: string
    providerDisplay: string
}

const getPriceImpactLevel = (
    priceImpact: Maybe<Decimal>,
    lowThreshold: Decimal,
    highThreshold: Decimal,
): PriceImpactLevel => {
    if (!priceImpact) return 'none'
    if (priceImpact.lessThan(lowThreshold)) return 'low'
    if (priceImpact.lessThan(highThreshold)) return 'medium'
    return 'high'
}

export const useSwapQuoteDetails = (
    quote: SwapQuote,
): UseSwapQuoteDetailsResult => {
    const remoteConfigService = useRemoteConfig()

    const lowThresholdValue = remoteConfigService.getNumberValue(
        RemoteConfigKeys.swap_price_impact_low_threshold,
    )
    const highThresholdValue = remoteConfigService.getNumberValue(
        RemoteConfigKeys.swap_price_impact_high_threshold,
    )
    const lowThreshold = useMemo(
        () => new Decimal(lowThresholdValue),
        [lowThresholdValue],
    )
    const highThreshold = useMemo(
        () => new Decimal(highThresholdValue),
        [highThresholdValue],
    )

    return useMemo(
        () => ({
            rateDisplay: formatSwapRate(quote),
            priceImpactDisplay: quote.priceImpact
                ? `${quote.priceImpact.toDecimalPlaces(2).toString()}%`
                : '-',
            priceImpactLevel: getPriceImpactLevel(
                quote.priceImpact,
                lowThreshold,
                highThreshold,
            ),
            slippageDisplay: quote.slippage
                ? `${apiSlippageToPercent(quote.slippage)}%`
                : '-',
            peraFeeDisplay: quote.peraFeeAmount
                ? formatAssetAmount(
                      quote.peraFeeAmount,
                      quote.peraFeeAsset ?? quote.assetIn,
                  )
                : '-',
            providerDisplay: quote.providerDisplayName ?? quote.provider ?? '-',
        }),
        [quote, lowThreshold, highThreshold],
    )
}
