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
import { AppState, Platform } from 'react-native'
import { Decimal } from 'decimal.js'
import {
    useCreateRampQuoteMutation,
    toOnrampUserMessage,
    filterQuotesByPaymentMethod,
    isSourceAmountTooHighError,
    isQuotableRampAmount,
    isRampQuoteExpired,
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
    /** True while the form is on screen; the expiry refresh runs only then. */
    isActive?: boolean
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
    /** Re-fetches quotes for the unchanged inputs (expired-quote recovery). */
    refreshQuotes: () => void
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
    isActive = true,
}: UseOnrampQuotesParams): UseOnrampQuotesResult => {
    const { t } = useLanguage()
    const { scope, address: selectedAccountAddress } = useOnrampAccount()

    const [quotes, setQuotes] = useState<RampQuote[]>([])
    // Keyed by provider + method, not quoteId: every re-quote mints new ids.
    // A null provider means the best offer within the method.
    const [selection, setSelection] =
        useState<
            Nullable<{ provider: Nullable<string>; paymentMethodId: string }>
        >(null)
    const [isQuoting, setIsQuoting] = useState(false)
    const [quotesError, setQuotesError] = useState<Nullable<string>>(null)
    const [quoteLimits, setQuoteLimits] =
        useState<Nullable<RampQuoteLimits>>(null)
    // Bumping it re-runs the fetch effect for the same inputs.
    const [refreshCount, setRefreshCount] = useState(0)
    const refreshQuotes = useCallback(
        () => setRefreshCount(count => count + 1),
        [],
    )

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

                    const now = Date.now()
                    // A quote that is already past its expiry on arrival means
                    // the device clock is off, so the router's answer to the
                    // order is the only reliable expiry for it.
                    const filtered = result
                        .filter(
                            quote =>
                                !excludedIds.includes(quote.paymentMethod.id),
                        )
                        .map(quote =>
                            isRampQuoteExpired(quote, now)
                                ? { ...quote, expiresAt: null }
                                : quote,
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
                                : (toOnrampUserMessage(error) ??
                                      t('errors.general.body'))
                        }
                        if (limits?.min) {
                            return t('onramp.form.amount_below_min', {
                                min: limits.min.toString(),
                            })
                        }
                        if (isSourceAmountTooLowError(error)) {
                            return t('onramp.form.amount_below_min_unknown')
                        }
                        return (
                            toOnrampUserMessage(error) ??
                            t('errors.general.body')
                        )
                    }
                    setQuotesError(quoteErrorMessageOf())
                    setIsQuoting(false)
                }
            })()
        }, ONRAMP_QUOTE_DEBOUNCE_TIME)

        return () => clearTimeout(timeoutId)
    }, [
        quoteRequestFor,
        sourceDecimals,
        amountKey,
        createQuote,
        t,
        refreshCount,
    ])

    const [isAppActive, setIsAppActive] = useState(
        AppState.currentState === 'active',
    )
    useEffect(() => {
        const subscription = AppState.addEventListener('change', state =>
            setIsAppActive(state === 'active'),
        )
        return () => subscription.remove()
    }, [])

    // An on-screen form re-quotes when the first quote expires. Off screen or
    // in the background it doesn't (each call is a real upstream quote), so
    // coming back re-checks what expired meanwhile.
    const isLive = isActive && isAppActive
    const wasLiveRef = useRef(isLive)
    useEffect(() => {
        const isRegained = isLive && !wasLiveRef.current
        wasLiveRef.current = isLive
        if (!isLive) return
        if (isRegained && quotes.some(quote => isRampQuoteExpired(quote))) {
            refreshQuotes()
            return
        }
        const expiries = quotes.flatMap(quote =>
            quote.expiresAt === null ? [] : [quote.expiresAt],
        )
        if (expiries.length === 0) return
        const timeoutId = setTimeout(
            refreshQuotes,
            Math.max(0, Math.min(...expiries) - Date.now()),
        )
        return () => clearTimeout(timeoutId)
    }, [isLive, quotes, refreshQuotes])

    // A probe answer for a pair the user has since left must not set limits.
    const pairIdRef = useRef(pairId)

    // Reset quotes + selection when the pair changes.
    useEffect(() => {
        pairIdRef.current = pairId
        setQuotes([])
        setSelection(null)
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
        if (selection === null) return bestQuote
        if (selection.provider === null) {
            return (
                pickBestQuote(
                    filterQuotesByPaymentMethod(
                        quotes,
                        selection.paymentMethodId,
                    ),
                ) ?? bestQuote
            )
        }
        return (
            quotes.find(
                quote =>
                    quote.provider === selection.provider &&
                    quote.paymentMethod.id === selection.paymentMethodId,
            ) ?? bestQuote
        )
    }, [quotes, selection, bestQuote])

    const selectQuote = useCallback(
        (quoteId: string) => {
            const quote = quotes.find(q => q.quoteId === quoteId)
            if (quote) {
                setSelection({
                    provider: quote.provider,
                    paymentMethodId: quote.paymentMethod.id,
                })
            }
        },
        [quotes],
    )

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

    // Choosing a payment method follows its best offer across refreshes; only
    // a provider pick pins the provider.
    const selectPaymentMethod = useCallback(
        (paymentMethodId: string) =>
            setSelection({ provider: null, paymentMethodId }),
        [],
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
        refreshQuotes,
    }
}
