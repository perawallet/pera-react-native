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

import { useCallback, useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    sortQuotesByAmountOutDesc,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { swapProviderDisplayName } from '../../utils/swapProviderDisplayName'

type UseSwapProviderContentParams = {
    scope: ChainScope
    quotes: SwapQuote[]
    selectedProviderName: Nullable<string>
}

type SwapProviderRow = {
    quote: SwapQuote
    iconUrl: Nullable<string>
    displayName: string
    amountDisplay: string
    /** In the preferred currency; null until a rate resolves. */
    fiatValue: Nullable<Decimal>
}

type UseSwapProviderContentResult = {
    userSelection: Nullable<string>
    rows: SwapProviderRow[]
    handleSelect: (providerName: Nullable<string>) => void
}

export const useSwapProviderContent = ({
    scope,
    quotes,
    selectedProviderName,
}: UseSwapProviderContentParams): UseSwapProviderContentResult => {
    const { usdToPreferred } = useCurrency(scope)

    const [userSelection, setUserSelection] =
        useState<Nullable<string>>(selectedProviderName)

    const handleSelect = useCallback(
        (providerName: Nullable<string>) => {
            trackEvent(SwapEvent.SelectProviderRouter, {
                [AnalyticsMetadataKey.ChainId]: scope.chainId,
                [AnalyticsMetadataKey.RouterName]: providerName ?? undefined,
            })
            setUserSelection(providerName)
        },
        [scope.chainId],
    )

    const alternativeQuotes = useMemo(() => {
        const uniqueProviders = new Map<string, SwapQuote>()
        for (const quote of sortQuotesByAmountOutDesc(quotes)) {
            if (!uniqueProviders.has(quote.provider)) {
                uniqueProviders.set(quote.provider, quote)
            }
        }
        // Auto already represents the provider with the top offer.
        return [...uniqueProviders.values()].slice(1)
    }, [quotes])

    const rows = useMemo<SwapProviderRow[]>(
        () =>
            alternativeQuotes.map(quote => {
                const amountDisplay = formatAssetAmount(
                    quote.amountOut,
                    quote.assetOut,
                )
                // A null conversion means the rate hasn't resolved; omit the
                // fiat line rather than showing every provider as worth 0.
                const fiatValue = quote.amountOutUsdValue
                    ? usdToPreferred(new Decimal(quote.amountOutUsdValue))
                    : null
                return {
                    quote,
                    iconUrl: quote.providerIconUrl,
                    displayName: swapProviderDisplayName(
                        quote.provider,
                        quote.providerDisplayName,
                    ),
                    amountDisplay,
                    fiatValue,
                }
            }),
        [alternativeQuotes, usdToPreferred],
    )

    return { userSelection, rows, handleSelect }
}
