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

import { useEffect, useMemo, useState } from 'react'
import type { Decimal } from 'decimal.js'
import {
    useOnramp,
    parseRampAmount,
    quoteDestinationAmount,
    type RampPair,
    type RampQuote,
    type RampQuoteLimits,
} from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { ONRAMP_AMOUNT_ERROR_DEBOUNCE_TIME } from '@constants/ui'
import { getXoLimitViolation, isMeldPair } from './onrampFormHelpers'
import { useOnrampQuotes } from './useOnrampQuotes'
import { useOnrampConfirm } from './useOnrampConfirm'
import { useOnrampSheets } from './useOnrampSheets'

type UseOnrampFormResult = {
    sourceAmount: string
    setSourceAmount: (value: string) => void
    destinationAmount: Nullable<Decimal>
    quotes: RampQuote[]
    selectedQuote: Nullable<RampQuote>
    selectQuote: (quoteId: string) => void
    selectedPaymentMethodId: Nullable<string>
    selectPaymentMethod: (paymentMethodId: string) => void
    isQuoting: boolean
    errorMessage: Nullable<string>
    limits: Nullable<RampQuoteLimits>
    /** True when the effective selected quote is the highest-receive offer. */
    isBestOffer: boolean
    /** True when the selected pair is a Meld pair (provider/payment-method rows). */
    isMeld: boolean
    /** Sender (source) address entered for XO orders; null when unset. */
    senderAddress: Nullable<string>
    isConfirming: boolean
    handleOpenSourceSelection: () => Promise<void>
    handleOpenDestinationSelection: () => Promise<void>
    handleOpenProvider: () => Promise<void>
    handleOpenPaymentMethod: () => Promise<void>
    handleOpenSenderAddress: () => Promise<void>
    handleConfirm: () => Promise<void>
}

/**
 * Drives the onramp buy form. The amount field and its derived display
 * (receive amount, limits, validation) live here; the quote lifecycle,
 * sheet handlers, and confirm flow are delegated to focused sub-hooks:
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
    const { t } = useLanguage()
    const {
        senderAddress,
        setSenderAddress,
        setSelectedSourceTokenId,
        setSelectedDestinationTokenId,
    } = useOnramp()

    const isMeld = isMeldPair(selectedPair)
    const pairId = selectedPair?.id ?? null

    const [sourceAmount, setSourceAmount] = useState('')
    const [limitError, setLimitError] = useState<Nullable<string>>(null)

    // Reset the amount when the pair changes. Meld (fiat) pairs default to 100
    // so a quote fetches immediately; XO pairs stay empty.
    useEffect(() => {
        setSourceAmount(isMeld ? '100' : '')
    }, [pairId, isMeld])

    const {
        quotes,
        isQuoting,
        quotesError,
        quoteLimits,
        selectedQuote,
        selectQuote,
        selectedPaymentMethodId,
        selectPaymentMethod,
        isBestOffer,
    } = useOnrampQuotes({ pairId, isMeld, sourceAmount })

    // --- destination amount + XO limits + inline validation --------------
    const destinationAmount = useMemo<Nullable<Decimal>>(() => {
        if (!selectedQuote) return null
        if (selectedQuote.kind === 'meld')
            return selectedQuote.destinationAmount
        if (parseRampAmount(sourceAmount) === null) return null
        return quoteDestinationAmount(selectedQuote, sourceAmount)
    }, [selectedQuote, sourceAmount])

    // XO quotes carry min/max in the quote itself; Meld limits only surface
    // through a SourceAmountIsTooLow quote error (quoteLimits).
    const xoLimits = useMemo<Nullable<{ min: Decimal; max: Decimal }>>(
        () =>
            selectedQuote?.kind === 'xo'
                ? { min: selectedQuote.min.value, max: selectedQuote.max.value }
                : null,
        [selectedQuote],
    )

    const limits = useMemo<Nullable<RampQuoteLimits>>(
        () => xoLimits ?? quoteLimits,
        [xoLimits, quoteLimits],
    )

    // XO inline limit validation, debounced so it doesn't flash mid-typing.
    // Meld validity comes from the fetch (no client-side limits), so the limit
    // error only ever applies to XO.
    useEffect(() => {
        if (selectedQuote?.kind !== 'xo') {
            setLimitError(null)
            return
        }
        const violation = getXoLimitViolation(selectedQuote, sourceAmount)
        const message =
            violation?.type === 'below'
                ? t('onramp.form.amount_below_min', { min: violation.min })
                : violation?.type === 'above'
                  ? t('onramp.form.amount_above_max', { max: violation.max })
                  : null

        const timeoutId = setTimeout(
            () => setLimitError(message),
            ONRAMP_AMOUNT_ERROR_DEBOUNCE_TIME,
        )
        return () => clearTimeout(timeoutId)
    }, [selectedQuote, sourceAmount, t])

    const sheets = useOnrampSheets({
        quotes,
        sourceAmount,
        // Pass the EFFECTIVE selected quote id (the auto-picked best when the
        // user hasn't chosen one) so the provider sheet pre-selects a radio on
        // first open rather than showing nothing selected.
        selectedQuoteId: selectedQuote?.quoteId ?? null,
        selectQuote,
        selectedPaymentMethodId,
        selectPaymentMethod,
        senderAddress,
        setSelectedSourceTokenId,
        setSelectedDestinationTokenId,
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

    return {
        sourceAmount,
        setSourceAmount,
        destinationAmount,
        quotes,
        selectedQuote,
        selectQuote,
        selectedPaymentMethodId,
        selectPaymentMethod,
        isQuoting,
        // Fetch errors and the XO limit error are disjoint (Meld never
        // validates limits; XO never re-fetches on amount edits), so a simple
        // precedence covers both.
        errorMessage: quotesError ?? limitError,
        limits,
        isBestOffer,
        isMeld,
        senderAddress: senderAddress === '' ? null : senderAddress,
        isConfirming,
        ...sheets,
        handleConfirm,
    }
}
