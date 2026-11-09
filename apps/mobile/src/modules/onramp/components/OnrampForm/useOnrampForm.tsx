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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Decimal } from 'decimal.js'
import {
    useOnramp,
    useRampRegionQuery,
    parseRampAmount,
    quoteUsdPrices,
    type RampPair,
    type RampQuote,
} from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { AnalyticsMetadataKey, OnrampEvent } from '@analytics'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'
import { useTrackOnrampEvent } from '@modules/onramp/hooks/useTrackOnrampEvent'
import { isMeldPair } from './onrampFormHelpers'
import { useOnrampQuotes } from './useOnrampQuotes'
import { useOnrampConfirm } from './useOnrampConfirm'
import { useOnrampSheets } from './useOnrampSheets'

type UseOnrampFormResult = {
    /** Raw text of the pay field. */
    sourceAmountText: string
    setSourceAmountText: (text: string) => void
    destinationAmount: Nullable<Decimal>
    /** USD per unit of the pay asset, from the selected quote; null until one arrives. */
    sourceUsdPrice: Nullable<Decimal>
    /** USD per unit of the receive asset, from the selected quote; null until one arrives. */
    destinationUsdPrice: Nullable<Decimal>
    quotes: RampQuote[]
    selectedQuote: Nullable<RampQuote>
    selectQuote: (quoteId: string) => void
    selectedPaymentMethodId: Nullable<string>
    selectPaymentMethod: (paymentMethodId: string) => void
    isQuoting: boolean
    errorMessage: Nullable<string>
    /** Whether a pay and a receive asset are both chosen, so there are limits to fill. */
    hasPair: boolean
    /** True when the effective selected quote is the highest-receive offer. */
    isBestOffer: boolean
    /** True when the selected pair is a Meld pair (provider/payment-method rows). */
    isMeld: boolean
    /** Sender (source) address entered for XO orders; null when unset. */
    senderAddress: Nullable<string>
    isConfirming: boolean
    /**
     * False while a quote is in flight: the router fills an order from the
     * stored quote, so it must match the amount entered.
     */
    canConfirm: boolean
    handleOpenSourceSelection: () => Promise<void>
    handleOpenDestinationSelection: () => Promise<void>
    handleOpenProvider: () => Promise<void>
    handleOpenPaymentMethod: () => Promise<void>
    handleOpenSenderAddress: () => Promise<void>
    handleConfirm: () => Promise<void>
    /** Fills the pay amount with the provider minimum, when the router names one. */
    handleMinPress: () => Promise<void>
    /** Fills the pay amount with the provider maximum, when the router names one. */
    handleMaxPress: () => Promise<void>
}

/**
 * Drives the onramp buy form. The amount field and its derived display
 * (receive amount, MIN/MAX fills) live here; the quote lifecycle, sheet handlers and
 * confirm flow are delegated to focused sub-hooks:
 *
 * - {@link useOnrampQuotes} — debounced fetching + quote/payment selection
 * - {@link useOnrampSheets} — the selection bottom-sheet handlers
 * - {@link useOnrampConfirm} — Terms gate, opt-in, order creation, routing
 *
 * `selectedPair` is passed in as an argument (the screen owns pair resolution
 * via `useOnrampScreen`), mirroring the "screen passes assets to the form hook"
 * shape and avoiding a second pairs-query read here.
 */
export const useOnrampForm = (
    selectedPair: Nullable<RampPair>,
    onNavigateToHistory?: () => void,
): UseOnrampFormResult => {
    const { scope } = useOnrampAccount()
    const { data: region } = useRampRegionQuery({ scope })
    const {
        senderAddress,
        setSenderAddress,
        setSelectedSourceTokenId,
        setSelectedDestinationTokenId,
        setSelectedChainId,
    } = useOnramp()

    const trackOnrampEvent = useTrackOnrampEvent()

    const isMeld = isMeldPair(selectedPair)
    const pairId = selectedPair?.id ?? null
    const sourceToken = selectedPair?.sourceToken ?? null
    const sourceChain = sourceToken?.network.name ?? ''

    const [sourceAmountText, setSourceAmountText] = useState('')
    const sourceAmountTextRef = useRef(sourceAmountText)
    useEffect(() => {
        sourceAmountTextRef.current = sourceAmountText
    }, [sourceAmountText])

    // Display units; null while the text is empty or not a plain decimal.
    const sourceAmount = useMemo(
        () => parseRampAmount(sourceAmountText),
        [sourceAmountText],
    )

    // Reset the amount when the pair changes. Meld (fiat) pairs default to 100
    // so a quote fetches immediately; XO pairs stay empty.
    useEffect(() => {
        setSourceAmountText(isMeld ? '100' : '')
    }, [pairId, isMeld])

    const {
        quotes,
        isQuoting,
        quotesError,
        selectedQuote,
        selectQuote,
        selectedPaymentMethodId,
        selectPaymentMethod,
        isBestOffer,
        resolveQuoteLimit,
    } = useOnrampQuotes({
        pair: selectedPair,
        sourceAmount,
        // Optional: a blank entry means no refund address, not an empty one.
        refundAddress: senderAddress.trim() || null,
        countryCode: region?.countryCode ?? null,
    })

    const destinationAmount = selectedQuote?.destinationAmount ?? null
    const { source: sourceUsdPrice, destination: destinationUsdPrice } =
        useMemo(() => quoteUsdPrices(selectedQuote), [selectedQuote])

    const sheets = useOnrampSheets({
        quotes,
        // Pass the EFFECTIVE selected quote id (the auto-picked best when the
        // user hasn't chosen one) so the provider sheet pre-selects a radio on
        // first open rather than showing nothing selected.
        selectedQuoteId: selectedQuote?.quoteId ?? null,
        selectQuote,
        selectedPaymentMethodId,
        selectPaymentMethod,
        destinationSymbol: selectedPair?.destinationToken.symbol ?? '',
        senderAddress,
        sourceToken,
        setSelectedSourceTokenId,
        setSelectedDestinationTokenId,
        setSelectedChainId,
        setSenderAddress,
    })

    const { isConfirming, handleConfirm } = useOnrampConfirm({
        selectedPair,
        selectedQuote,
        sourceAmount,
        destinationAmount,
        isMeld,
        onNavigateToHistory,
    })

    // toFixed, not toString: a small limit would otherwise land as "1e-8".
    const fillLimit = useCallback(
        async (bound: 'min' | 'max') => {
            trackOnrampEvent(
                bound === 'min' ? OnrampEvent.MinTap : OnrampEvent.MaxTap,
                sourceChain === ''
                    ? undefined
                    : { [AnalyticsMetadataKey.SourceChain]: sourceChain },
            )
            const textAtTap = sourceAmountTextRef.current
            const limit = await resolveQuoteLimit(bound)
            // A probe can take a while; what the user typed meanwhile wins.
            if (limit === null || sourceAmountTextRef.current !== textAtTap) {
                return
            }
            setSourceAmountText(limit.toFixed())
        },
        [resolveQuoteLimit, sourceChain, trackOnrampEvent],
    )

    const handleMinPress = useCallback(() => fillLimit('min'), [fillLimit])
    const handleMaxPress = useCallback(() => fillLimit('max'), [fillLimit])

    const canConfirm =
        selectedQuote !== null &&
        sourceAmountText !== '' &&
        destinationAmount !== null &&
        quotesError === null &&
        !isQuoting &&
        !isConfirming

    return {
        sourceAmountText,
        setSourceAmountText,
        destinationAmount,
        sourceUsdPrice,
        destinationUsdPrice,
        quotes,
        selectedQuote,
        selectQuote,
        selectedPaymentMethodId,
        selectPaymentMethod,
        isQuoting,
        errorMessage: quotesError,
        hasPair: selectedPair !== null,
        isBestOffer,
        isMeld,
        senderAddress: senderAddress === '' ? null : senderAddress,
        isConfirming,
        canConfirm,
        ...sheets,
        handleConfirm,
        handleMinPress,
        handleMaxPress,
    }
}
