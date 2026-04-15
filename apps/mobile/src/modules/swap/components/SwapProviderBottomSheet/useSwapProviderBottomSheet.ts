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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { formatCurrency } from '@perawallet/wallet-core-shared'
import {
    useProvidersQuery,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { sortQuotesByAmountOutDesc } from '../../hooks/swapQuoteHelpers'

type UseSwapProviderBottomSheetParams = {
    isVisible: boolean
    quotes: SwapQuote[]
    selectedProviderName: string | null
    onApply: (providerName: string | null) => void
    onClose: () => void
}

export type SwapProviderRow = {
    quote: SwapQuote
    iconUrl: string | undefined
    displayName: string
    amountDisplay: string
    fiatDisplay: string | undefined
}

type UseSwapProviderBottomSheetResult = {
    userSelection: string | null
    rows: SwapProviderRow[]
    handleSelect: (providerName: string | null) => void
    handleApply: () => void
}

export const useSwapProviderBottomSheet = ({
    isVisible,
    quotes,
    selectedProviderName,
    onApply,
    onClose,
}: UseSwapProviderBottomSheetParams): UseSwapProviderBottomSheetResult => {
    const { preferredCurrency, usdToPreferred } = useCurrency()
    const { data: providers } = useProvidersQuery()

    const [userSelection, setUserSelection] = useState<string | null>(
        selectedProviderName,
    )

    useEffect(() => {
        if (isVisible) setUserSelection(selectedProviderName)
    }, [isVisible, selectedProviderName])

    const handleSelect = useCallback((providerName: string | null) => {
        setUserSelection(providerName)
    }, [])

    const handleApply = useCallback(() => {
        onApply(userSelection)
        onClose()
    }, [userSelection, onApply, onClose])

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
                const fiatDisplay = quote.amountOutUsdValue
                    ? formatCurrency(
                          usdToPreferred(new Decimal(quote.amountOutUsdValue)),
                          2,
                          preferredCurrency,
                      )
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

    return { userSelection, rows, handleSelect, handleApply }
}
