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
import { Platform } from 'react-native'
import { useSelectedAccountAddress } from '@perawallet/wallet-core-accounts'
import {
    useCreateRampQuoteMutation,
    toOnrampUserMessage,
    parseRampAmount,
    pickBestQuote,
    type RampQuote,
} from '@perawallet/wallet-core-onramp'
import {
    isConnectivityError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { ONRAMP_QUOTE_DEBOUNCE_TIME } from '@constants/ui'
import { getExcludedPaymentMethodIds } from './onrampFormHelpers'

type UseOnrampQuotesParams = {
    pairId: Nullable<string>
    isMeld: boolean
    sourceAmount: string
}

type UseOnrampQuotesResult = {
    quotes: RampQuote[]
    isQuoting: boolean
    /** Fetch-side error (no payment methods / request failure); null otherwise. */
    quotesError: Nullable<string>
    /** Effective selected quote: the user's pick, else the auto-picked best. */
    selectedQuote: Nullable<RampQuote>
    selectQuote: (quoteId: string) => void
    selectedPaymentMethodId: Nullable<string>
    selectPaymentMethod: (paymentMethodId: string) => void
    /** True when the effective selected quote is the highest-receive offer. */
    isBestOffer: boolean
}

/**
 * Owns the quote lifecycle for the onramp form: debounced fetching and the
 * "which quote is selected" logic. Split out of `useOnrampForm` so the form
 * hook stays focused on the amount field and the confirm flow.
 *
 * Stale-quote guard: `useCreateRampQuoteMutation` does not thread an
 * AbortSignal through `mutateAsync`, so a monotonically increasing request-id
 * ref tags every fetch and only the latest tagged result is applied.
 */
export const useOnrampQuotes = ({
    pairId,
    isMeld,
    sourceAmount,
}: UseOnrampQuotesParams): UseOnrampQuotesResult => {
    const { t } = useLanguage()
    const { selectedAccountAddress } = useSelectedAccountAddress()

    const [quotes, setQuotes] = useState<RampQuote[]>([])
    const [selectedQuoteId, setSelectedQuoteId] =
        useState<Nullable<string>>(null)
    const [isQuoting, setIsQuoting] = useState(false)
    const [quotesError, setQuotesError] = useState<Nullable<string>>(null)

    // React Query v5 mutateAsync is referentially stable, so it can sit in the
    // effect dependency list without retriggering it.
    const { mutateAsync: createQuote } = useCreateRampQuoteMutation()
    const requestIdRef = useRef(0)

    // --- debounced fetch -------------------------------------------------
    // Meld re-quotes on every amount change; XO quotes once per pair with a
    // null source amount (the provider returns a fixed rate + limits), so the
    // XO branch never reacts to amount edits.
    const meldAmountTrigger = isMeld ? sourceAmount : ''
    useEffect(() => {
        if (!pairId || !selectedAccountAddress) {
            return
        }
        // Empty or malformed (e.g. pasted) amount → no quote to fetch.
        const parsedMeldAmount = isMeld
            ? parseRampAmount(meldAmountTrigger)
            : null
        if (isMeld && parsedMeldAmount === null) {
            setQuotes([])
            return
        }

        const requestId = ++requestIdRef.current
        setIsQuoting(true)
        const excludedIds = getExcludedPaymentMethodIds(Platform.OS)

        const timeoutId = setTimeout(() => {
            void (async () => {
                try {
                    const result = await createQuote({
                        pair: pairId,
                        destinationAddress: selectedAccountAddress,
                        sourceAmount: parsedMeldAmount?.toNumber() ?? null,
                    })
                    if (requestId !== requestIdRef.current) return

                    const filtered = result.filter(
                        quote => !excludedIds.includes(quote.paymentMethod.id),
                    )
                    setQuotes(filtered)
                    setQuotesError(
                        filtered.length === 0
                            ? t('onramp.form.no_payment_methods')
                            : null,
                    )
                    setIsQuoting(false)
                } catch (error) {
                    if (requestId !== requestIdRef.current) return
                    setQuotes([])
                    setQuotesError(
                        isConnectivityError(error)
                            ? t('errors.network.no_connection.body')
                            : toOnrampUserMessage(error),
                    )
                    setIsQuoting(false)
                }
            })()
        }, ONRAMP_QUOTE_DEBOUNCE_TIME)

        return () => clearTimeout(timeoutId)
    }, [
        pairId,
        selectedAccountAddress,
        isMeld,
        meldAmountTrigger,
        createQuote,
        t,
    ])

    // Reset quotes + selection when the pair changes.
    useEffect(() => {
        setQuotes([])
        setSelectedQuoteId(null)
        setQuotesError(null)
    }, [pairId, isMeld])

    // --- selection -------------------------------------------------------
    const bestQuote = useMemo(
        () => pickBestQuote(quotes, sourceAmount),
        [quotes, sourceAmount],
    )

    const selectedQuote = useMemo<Nullable<RampQuote>>(() => {
        if (selectedQuoteId === null) return bestQuote
        return (
            quotes.find(quote => quote.quoteId === selectedQuoteId) ?? bestQuote
        )
    }, [quotes, selectedQuoteId, bestQuote])

    const selectQuote = useCallback((quoteId: string) => {
        setSelectedQuoteId(quoteId)
    }, [])

    // Choosing a payment method selects the best quote offering that method.
    const selectPaymentMethod = useCallback(
        (paymentMethodId: string) => {
            const candidates = quotes.filter(
                quote => quote.paymentMethod.id === paymentMethodId,
            )
            const best = pickBestQuote(candidates, sourceAmount)
            if (best) setSelectedQuoteId(best.quoteId)
        },
        [quotes, sourceAmount],
    )

    return {
        quotes,
        isQuoting,
        quotesError,
        selectedQuote,
        selectQuote,
        selectedPaymentMethodId: selectedQuote?.paymentMethod.id ?? null,
        selectPaymentMethod,
        isBestOffer:
            selectedQuote !== null &&
            selectedQuote.quoteId === bestQuote?.quoteId,
    }
}
