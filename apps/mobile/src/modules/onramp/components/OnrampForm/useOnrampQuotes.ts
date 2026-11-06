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
import { Decimal } from 'decimal.js'
import {
    useCreateRampQuoteMutation,
    toOnrampUserMessage,
    filterQuotesByPaymentMethod,
    isSourceAmountTooHighError,
    isQuotableRampAmount,
    isSourceAmountTooLowError,
    pickBestQuote,
    RAMP_MAX_LIMIT_PROBE_AMOUNT,
    resolveRampQuoteLimits,
    type RampPair,
    type RampQuote,
    type RampQuoteLimits,
} from '@perawallet/wallet-core-onramp'
import {
    baseUnitsToDisplayUnits,
    isConnectivityError,
    ZERO_DECIMAL,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { ONRAMP_QUOTE_DEBOUNCE_TIME } from '@constants/ui'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'
import { getExcludedPaymentMethodIds } from './onrampFormHelpers'

type UseOnrampQuotesParams = {
    pair: Nullable<RampPair>
    /** Display units; null when no valid amount is entered. */
    sourceAmount: Nullable<Decimal>
    /** Where a deposit is returned to; only a deposit source sends it. */
    refundAddress: Nullable<string>
    /** The user's region; narrows the router's offers. */
    countryCode: Nullable<string>
}

type UseOnrampQuotesResult = {
    quotes: RampQuote[]
    isQuoting: boolean
    /** Fetch-side error (no payment methods / request failure); null otherwise. */
    quotesError: Nullable<string>
    /**
     * Source min/max from a refused amount. Sticky across later successes so
     * the MIN/MAX pill stays usable; cleared on pair change.
     */
    quoteLimits: Nullable<RampQuoteLimits>
    /** Effective selected quote: the user's pick, else the auto-picked best. */
    selectedQuote: Nullable<RampQuote>
    selectQuote: (quoteId: string) => void
    selectedPaymentMethodId: Nullable<string>
    selectPaymentMethod: (paymentMethodId: string) => void
    /** True when the effective selected quote is the highest-receive offer. */
    isBestOffer: boolean
    /**
     * The pair's source min or max in display units: the known one, else what
     * one probe quote reveals. Null when the router names no such limit or the
     * probe fails.
     */
    resolveQuoteLimit: (bound: 'min' | 'max') => Promise<Nullable<Decimal>>
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
    pair,
    sourceAmount,
    refundAddress,
    countryCode,
}: UseOnrampQuotesParams): UseOnrampQuotesResult => {
    const { t } = useLanguage()
    const { scope, address: selectedAccountAddress } = useOnrampAccount()

    const [quotes, setQuotes] = useState<RampQuote[]>([])
    const [selectedQuoteId, setSelectedQuoteId] =
        useState<Nullable<string>>(null)
    const [isQuoting, setIsQuoting] = useState(false)
    const [quotesError, setQuotesError] = useState<Nullable<string>>(null)
    const [quoteLimits, setQuoteLimits] =
        useState<Nullable<RampQuoteLimits>>(null)

    // React Query v5 mutateAsync is referentially stable, so it can sit in the
    // effect dependency list without retriggering it.
    const { mutateAsync: createQuote } = useCreateRampQuoteMutation()
    const requestIdRef = useRef(0)

    // The effect keys on the pair's primitives, not the object: a caller that
    // rebuilt the pair every render would otherwise refetch in a loop.
    const pairId = pair?.id ?? null
    const sourceId = pair?.sourceToken.id ?? null
    const sourceKind = pair?.sourceToken.kind ?? null
    const sourceDecimals = pair?.sourceToken.fractionDecimals ?? 0
    const destinationId = pair?.destinationToken.id ?? null
    const destinationDecimals = pair?.destinationToken.fractionDecimals ?? 0

    // Keyed on the amount's value, not the Decimal's identity, for the same reason.
    const amountKey = sourceAmount?.toFixed() ?? null

    // Null until there is a pair, an account and a scope to quote for.
    const quoteRequestFor = useCallback(
        (amount: Decimal): Nullable<Parameters<typeof createQuote>[0]> =>
            sourceId === null ||
            sourceKind === null ||
            destinationId === null ||
            !selectedAccountAddress ||
            scope === null
                ? null
                : {
                      scope,
                      sourceToken: {
                          id: sourceId,
                          kind: sourceKind,
                          fractionDecimals: sourceDecimals,
                      },
                      destinationToken: {
                          id: destinationId,
                          fractionDecimals: destinationDecimals,
                      },
                      sourceAmount: amount,
                      destinationAddress: selectedAccountAddress,
                      countryCode,
                      refundAddress,
                  },
        [
            sourceId,
            sourceKind,
            sourceDecimals,
            destinationId,
            destinationDecimals,
            selectedAccountAddress,
            scope,
            countryCode,
            refundAddress,
        ],
    )

    // --- debounced fetch -------------------------------------------------
    // Every provider quotes per amount: the router prices a request, so a
    // missing amount, or one under a single base unit, has nothing to ask.
    useEffect(() => {
        const amount = amountKey === null ? null : new Decimal(amountKey)
        const request = quoteRequestFor(amount ?? ZERO_DECIMAL)
        if (request === null) return
        const requestId = ++requestIdRef.current
        if (amount === null || !isQuotableRampAmount(amount, sourceDecimals)) {
            setQuotes([])
            setQuotesError(null)
            setIsQuoting(false)
            return
        }

        setIsQuoting(true)
        const excludedIds = getExcludedPaymentMethodIds(Platform.OS)

        const timeoutId = setTimeout(() => {
            void (async () => {
                try {
                    const result = await createQuote(request)
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
                    const limits = resolveRampQuoteLimits(error)
                    setQuoteLimits(limits)
                    const quoteErrorMessageOf = () => {
                        if (isConnectivityError(error)) {
                            return t('errors.network.no_connection.body')
                        }
                        if (isSourceAmountTooHighError(error)) {
                            return limits?.max
                                ? t('onramp.form.amount_above_max', {
                                      max: limits.max.toString(),
                                  })
                                : toOnrampUserMessage(error)
                        }
                        if (limits?.min) {
                            return t('onramp.form.amount_below_min', {
                                min: limits.min.toString(),
                            })
                        }
                        if (isSourceAmountTooLowError(error)) {
                            return t('onramp.form.amount_below_min_unknown')
                        }
                        return toOnrampUserMessage(error)
                    }
                    setQuotesError(quoteErrorMessageOf())
                    setIsQuoting(false)
                }
            })()
        }, ONRAMP_QUOTE_DEBOUNCE_TIME)

        return () => clearTimeout(timeoutId)
    }, [quoteRequestFor, sourceDecimals, amountKey, createQuote, t])

    // A probe answer for a pair the user has since left must not set limits.
    const pairIdRef = useRef(pairId)

    // Reset quotes + selection when the pair changes.
    useEffect(() => {
        pairIdRef.current = pairId
        setQuotes([])
        setSelectedQuoteId(null)
        setQuotesError(null)
        setQuoteLimits(null)
    }, [pairId])

    // The router only names limits when it refuses an amount, so an unknown
    // limit is asked for with an amount at the edge: one base unit for the
    // minimum, a huge amount for the maximum. The probe stays off the quote
    // state, since it isn't the amount the user entered.
    const resolveQuoteLimit = useCallback(
        async (bound: 'min' | 'max'): Promise<Nullable<Decimal>> => {
            const known = quoteLimits?.[bound] ?? null
            if (known !== null) return known
            const probeAmount =
                bound === 'min'
                    ? baseUnitsToDisplayUnits(1, sourceDecimals)
                    : RAMP_MAX_LIMIT_PROBE_AMOUNT
            const request = quoteRequestFor(probeAmount)
            if (request === null) return null
            const probePairId = pairId
            try {
                await createQuote(request)
                if (pairIdRef.current !== probePairId) return null
                return bound === 'min' ? probeAmount : null
            } catch (error) {
                if (pairIdRef.current !== probePairId) return null
                const limits = resolveRampQuoteLimits(error)
                if (limits === null) return null
                setQuoteLimits(previous => ({
                    min: limits.min ?? previous?.min ?? null,
                    max: limits.max ?? previous?.max ?? null,
                }))
                return limits[bound]
            }
        },
        [quoteLimits, pairId, sourceDecimals, quoteRequestFor, createQuote],
    )

    // --- selection -------------------------------------------------------
    const bestQuote = useMemo(() => pickBestQuote(quotes), [quotes])

    const selectedQuote = useMemo<Nullable<RampQuote>>(() => {
        if (selectedQuoteId === null) return bestQuote
        return (
            quotes.find(quote => quote.quoteId === selectedQuoteId) ?? bestQuote
        )
    }, [quotes, selectedQuoteId, bestQuote])

    const selectQuote = useCallback((quoteId: string) => {
        setSelectedQuoteId(quoteId)
    }, [])

    // "Best offer" ranks providers within one payment method, matching the
    // provider sheet — a card quote is not comparable with a bank-transfer one.
    const isBestOffer = useMemo(() => {
        if (selectedQuote === null) return false
        const sameMethod = filterQuotesByPaymentMethod(
            quotes,
            selectedQuote.paymentMethod.id,
        )
        return pickBestQuote(sameMethod)?.quoteId === selectedQuote.quoteId
    }, [quotes, selectedQuote])

    // Choosing a payment method selects the best quote offering that method.
    const selectPaymentMethod = useCallback(
        (paymentMethodId: string) => {
            const candidates = quotes.filter(
                quote => quote.paymentMethod.id === paymentMethodId,
            )
            const best = pickBestQuote(candidates)
            if (best) setSelectedQuoteId(best.quoteId)
        },
        [quotes],
    )

    return {
        quotes,
        isQuoting,
        quotesError,
        quoteLimits,
        selectedQuote,
        selectQuote,
        selectedPaymentMethodId: selectedQuote?.paymentMethod.id ?? null,
        selectPaymentMethod,
        isBestOffer,
        resolveQuoteLimit,
    }
}
