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
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'
import {
    formatCurrency,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    useProvidersQuery,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { sortQuotesByAmountOutDesc } from '../../hooks/swapQuoteHelpers'

type UseSwapProviderContentParams = {
    quotes: SwapQuote[]
    selectedProviderName: Nullable<string>
}

type SwapProviderRow = {
    quote: SwapQuote
    iconUrl: Optional<string>
    displayName: string
    amountDisplay: string
    fiatDisplay: Optional<string>
}

type UseSwapProviderContentResult = {
    userSelection: Nullable<string>
    rows: SwapProviderRow[]
    handleSelect: (providerName: Nullable<string>) => void
}

export const useSwapProviderContent = ({
    quotes,
    selectedProviderName,
}: UseSwapProviderContentParams): UseSwapProviderContentResult => {
    const { preferredCurrency, usdToPreferred } = useCurrency()
    const { data: providers } = useProvidersQuery()

    const [userSelection, setUserSelection] =
        useState<Nullable<string>>(selectedProviderName)

    const handleSelect = useCallback((providerName: Nullable<string>) => {
        trackEvent(SwapEvent.SelectProviderRouter, {
            [AnalyticsMetadataKey.RouterName]: providerName ?? undefined,
        })
        setUserSelection(providerName)
    }, [])

    const sortedQuotes = useMemo(
        () => sortQuotesByAmountOutDesc(quotes),
        [quotes],
    )

    // Auto row already represents the top quote; drop it from the explicit list.
    const alternativeQuotes = useMemo(
        () => sortedQuotes.slice(1),
        [sortedQuotes],
    )

    const rows = useMemo<SwapProviderRow[]>(
        () =>
            alternativeQuotes.map(quote => {
                const providerItem = providers?.find(
                    item => item.name === quote.provider,
                )
                const displayName =
                    quote.providerDisplayName ??
                    providerItem?.displayName ??
                    quote.provider ??
                    '-'
                const amountDisplay = quote.amountOut
                    ? formatAssetAmount(quote.amountOut, quote.assetOut)
                    : '-'
                // A null conversion means the rate hasn't resolved; omit the
                // fiat line rather than showing every provider as worth 0.
                const fiatValue = quote.amountOutUsdValue
                    ? usdToPreferred(new Decimal(quote.amountOutUsdValue))
                    : null
                const fiatDisplay = fiatValue
                    ? formatCurrency(fiatValue, 2, preferredCurrency)
                    : undefined
                return {
                    quote,
                    iconUrl: providerItem?.iconUrl,
                    displayName,
                    amountDisplay,
                    fiatDisplay,
                }
            }),
        [alternativeQuotes, providers, usdToPreferred, preferredCurrency],
    )

    return { userSelection, rows, handleSelect }
}
