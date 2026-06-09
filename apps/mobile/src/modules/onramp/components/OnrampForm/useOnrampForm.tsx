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

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Linking, Platform } from 'react-native'
import { type Decimal } from 'decimal.js'
import {
    useSelectedAccountAddress,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { getKnownAssetId } from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useCreateRampQuoteMutation,
    useCreateRampOrderMutation,
    useEnsureDestinationOptIn,
    useOnramp,
    toOnrampUserMessage,
    parseRampAmount,
    pickBestQuote,
    quoteDestinationAmount,
    type RampPair,
    type RampQuote,
} from '@perawallet/wallet-core-onramp'
import { ZERO_DECIMAL, type Nullable } from '@perawallet/wallet-core-shared'
import { trackEvent, OnrampEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { OptInConfirmationContent } from '@modules/assets/components/OptInConfirmationContent'
import { OnrampOrderDetailsContent } from '../OnrampOrderDetailsContent'
import { OnrampTermsContent } from '../OnrampTermsContent'
import {
    buildPendingXoHistoryItem,
    getExcludedPaymentMethodIds,
    isMeldPair,
} from './onrampFormHelpers'
import { useOnrampSheets } from './useOnrampSheets'
import { useOnrampTerms } from './useOnrampTerms'

type UseOnrampFormResult = {
    sourceAmount: string
    setSourceAmount: (value: string) => void
    destinationAmount: Nullable<Decimal>
    quotes: RampQuote[]
    selectedQuote: Nullable<RampQuote>
    selectedQuoteId: Nullable<string>
    selectQuote: (quoteId: string) => void
    selectedPaymentMethodId: Nullable<string>
    selectPaymentMethod: (paymentMethodId: string) => void
    isQuoting: boolean
    errorMessage: Nullable<string>
    limits: Nullable<{ min: Decimal; max: Decimal }>
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

const QUOTE_DEBOUNCE_MS = 500
const ERROR_MESSAGE_DEBOUNCE_MS = 300

/**
 * Drives the onramp buy form.
 *
 * `selectedPair` is passed in as an argument (the screen owns pair resolution
 * via `useOnrampScreen`), mirroring the "screen passes assets to the form hook"
 * shape and avoiding a second pairs-query read here.
 *
 * Stale-quote guard: `useCreateRampQuoteMutation` does not thread an
 * AbortSignal through `mutateAsync`, so a monotonically increasing request-id
 * ref tags every fetch and only the latest tagged result is applied.
 *
 * XO destination-amount formula: `amountIn * amount.value - minerFee.value`
 * (ported from the web `useSwapForm.ts`). Meld reads `destinationAmount`
 * straight off the quote.
 */
export const useOnrampForm = (
    selectedPair: Nullable<RampPair>,
    onNavigateToHistory?: () => void,
): UseOnrampFormResult => {
    const [sourceAmount, setSourceAmountState] = useState('')
    const [quotes, setQuotes] = useState<RampQuote[]>([])
    const [selectedQuoteId, setSelectedQuoteId] =
        useState<Nullable<string>>(null)
    const [errorMessage, setErrorMessage] = useState<Nullable<string>>(null)
    const [isQuoting, setIsQuoting] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)

    const { t } = useLanguage()
    const { network } = useNetwork()
    const { selectedAccountAddress } = useSelectedAccountAddress()
    const {
        senderAddress,
        setSenderAddress,
        setSelectedSourceTokenId,
        setSelectedDestinationTokenId,
    } = useOnramp()
    const { request: requestBottomSheet } = useBottomSheet()
    const { errorToast } = useToast()
    const { isTermsAccepted, markTermsAccepted } = useOnrampTerms()

    // React Query v5 mutateAsync is referentially stable, so it can sit in
    // effect dependency lists without retriggering them.
    const { mutateAsync: createQuote } = useCreateRampQuoteMutation()
    const { mutateAsync: createOrder } = useCreateRampOrderMutation()
    const { ensureOptIn } = useEnsureDestinationOptIn()

    const requestIdRef = useRef(0)

    const isMeld = isMeldPair(selectedPair)
    const pairId = selectedPair?.id ?? null

    const setSourceAmount = useCallback((value: string) => {
        setSourceAmountState(value)
    }, [])

    // --- debounced quote fetch ------------------------------------------
    // Meld re-quotes on every amount change; XO quotes once per pair with a
    // null source amount (the provider returns a fixed rate + limits), so the
    // XO branch never reacts to amount edits — its inline limit validation
    // lives in a separate effect and must not be clobbered by a re-fetch.
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
            setSelectedQuoteId(null)
            return
        }

        const requestId = ++requestIdRef.current
        setIsQuoting(true)
        const excludedIds = getExcludedPaymentMethodIds(Platform.OS)

        const timeoutId = setTimeout(() => {
            const fetchQuotes = async () => {
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
                    setErrorMessage(
                        filtered.length === 0
                            ? t('onramp.form.no_payment_methods')
                            : null,
                    )
                    setIsQuoting(false)
                } catch (error) {
                    if (requestId !== requestIdRef.current) return
                    setQuotes([])
                    setSelectedQuoteId(null)
                    setErrorMessage(toOnrampUserMessage(error))
                    setIsQuoting(false)
                }
            }
            void fetchQuotes()
        }, QUOTE_DEBOUNCE_MS)

        return () => clearTimeout(timeoutId)
    }, [
        pairId,
        selectedAccountAddress,
        isMeld,
        meldAmountTrigger,
        createQuote,
        t,
    ])

    // Reset selection and amount when the pair changes. Meld (fiat) pairs
    // default to 100 so a quote fetches immediately; XO pairs stay empty.
    useEffect(() => {
        setSourceAmountState(isMeld ? '100' : '')
        setQuotes([])
        setSelectedQuoteId(null)
        setErrorMessage(null)
    }, [pairId, isMeld])

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

    const selectedPaymentMethodId = selectedQuote?.paymentMethod.id ?? null
    const isBestOffer =
        selectedQuote !== null && selectedQuote.quoteId === bestQuote?.quoteId

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

    // --- destination amount, limits + inline validation -----------------
    const destinationAmount = useMemo<Nullable<Decimal>>(() => {
        if (!selectedQuote) return null
        if (selectedQuote.kind === 'meld')
            return selectedQuote.destinationAmount
        if (parseRampAmount(sourceAmount) === null) return null
        return quoteDestinationAmount(selectedQuote, sourceAmount)
    }, [selectedQuote, sourceAmount])

    // Only XO quotes carry min/max source limits.
    const limits = useMemo<Nullable<{ min: Decimal; max: Decimal }>>(
        () =>
            selectedQuote?.kind === 'xo'
                ? { min: selectedQuote.min.value, max: selectedQuote.max.value }
                : null,
        [selectedQuote],
    )

    // XO inline limit validation. Applying the message is debounced so it
    // doesn't flash mid-typing. Fetch errors share the same errorMessage state;
    // XO never re-fetches on amount edits, so the two writers don't race.
    useEffect(() => {
        if (!selectedQuote || selectedQuote.kind !== 'xo') {
            return
        }

        const parsed = parseRampAmount(sourceAmount)
        let message: Nullable<string> = null
        if (parsed !== null) {
            if (parsed.lessThan(selectedQuote.min.value)) {
                message = t('onramp.form.amount_below_min', {
                    min: selectedQuote.min.value.toString(),
                })
            } else if (parsed.greaterThan(selectedQuote.max.value)) {
                message = t('onramp.form.amount_above_max', {
                    max: selectedQuote.max.value.toString(),
                })
            }
        }

        const timeoutId = setTimeout(() => {
            setErrorMessage(message)
        }, ERROR_MESSAGE_DEBOUNCE_MS)

        return () => clearTimeout(timeoutId)
    }, [selectedQuote, sourceAmount, t])

    // --- sheet handlers --------------------------------------------------
    const {
        handleOpenSourceSelection,
        handleOpenDestinationSelection,
        handleOpenProvider,
        handleOpenPaymentMethod,
        handleOpenSenderAddress,
    } = useOnrampSheets({
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

    // --- confirm flow ----------------------------------------------------
    const handleConfirm = useCallback(async () => {
        const parsedSourceAmount = parseRampAmount(sourceAmount)
        if (
            !selectedPair ||
            !selectedQuote ||
            parsedSourceAmount === null ||
            !selectedAccountAddress
        ) {
            return
        }

        // First XO (crypto→ALGO) order requires a one-time Terms acceptance.
        // Gate runs BEFORE setIsConfirming(true) so the button isn't stuck in a
        // loading state while the sheet is open, and so an early return on
        // dismiss leaves isConfirming untouched.
        if (!isMeld && !isTermsAccepted) {
            const accepted = await requestBottomSheet<boolean>({
                contents: <OnrampTermsContent />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!accepted) return
            markTermsAccepted()
        }

        trackEvent(OnrampEvent.ProceedTap)
        setIsConfirming(true)
        try {
            // v2 safety: re-read the selected account at call time in case it
            // changed (or was removed) since the form first rendered.
            const currentAddress =
                useAccountsStore.getState().selectedAccountAddress ??
                selectedAccountAddress

            const destinationToken = selectedPair.destinationToken
            const isAlgoDestination =
                destinationToken.id === 'ALGO' ||
                destinationToken.symbol === 'ALGO'
            // The ramp token id is symbolic (e.g. 'USDC_ALGORAND'); resolve the
            // network-correct on-chain ASA id. Only USDC is opt-in-able today.
            const destinationAssetId: bigint | 'ALGO' = isAlgoDestination
                ? 'ALGO'
                : BigInt(getKnownAssetId('USDC', network))

            // Opt-in MUST resolve before the order is created. The user
            // confirms it via the standard opt-in sheet — with a 0 fee when
            // the opt-in is sponsored (fee-delegated). Declining cancels the
            // whole order quietly.
            const optInConfirmed = await ensureOptIn({
                address: currentAddress,
                destinationAssetId,
                confirmOptIn: async ({ assetId, isSponsored }) => {
                    const result = await requestBottomSheet<'confirm'>({
                        contents: (
                            <OptInConfirmationContent
                                assetId={assetId.toString()}
                                accountAddress={currentAddress}
                                fee={isSponsored ? ZERO_DECIMAL : undefined}
                            />
                        ),
                        options: { size: 'auto', enablePanDownToClose: true },
                    })
                    return result === 'confirm'
                },
            })
            if (!optInConfirmed) {
                return
            }

            // XO sender address is optional — send null (not an empty string)
            // when unset, or the backend rejects it as a missing required field.
            const sourceAddress = isMeld
                ? currentAddress
                : senderAddress.trim() || null
            const order = await createOrder({
                quote: selectedQuote.quoteId,
                sourceAmount,
                sourceAddress,
            })

            if (order.kind === 'meld') {
                // Meld's KYC/payment widget must run in the OS browser, not an
                // in-app webview — the webview blocks some of the provider
                // payment flows (matching the web app, which opens the system
                // browser here).
                void Linking.openURL(order.widgetUrl)
            } else {
                // A freshly-placed XO order is a pending history entry — render
                // the shared order-details sheet (titled "Swap Review").
                const reviewItem = buildPendingXoHistoryItem(
                    order,
                    selectedPair,
                    parsedSourceAmount,
                    destinationAmount,
                    new Date().toISOString(),
                )
                await requestBottomSheet({
                    contents: (
                        <OnrampOrderDetailsContent
                            item={reviewItem}
                            title={t('onramp.order_review.xo_title')}
                        />
                    ),
                    options: {
                        size: 'modal',
                        enablePanDownToClose: false,
                        enableCloseOnBackdropPress: false,
                        autoCreateContainer: false,
                    },
                })
                // The order is now pending — surface it in History once the
                // user closes the review.
                onNavigateToHistory?.()
            }
        } catch (error) {
            errorToast('', toOnrampUserMessage(error))
        } finally {
            setIsConfirming(false)
        }
    }, [
        selectedPair,
        selectedQuote,
        sourceAmount,
        destinationAmount,
        selectedAccountAddress,
        network,
        isMeld,
        senderAddress,
        isTermsAccepted,
        markTermsAccepted,
        ensureOptIn,
        createOrder,
        requestBottomSheet,
        errorToast,
        onNavigateToHistory,
        t,
    ])

    return {
        sourceAmount,
        setSourceAmount,
        destinationAmount,
        quotes,
        selectedQuote,
        selectedQuoteId,
        selectQuote,
        selectedPaymentMethodId,
        selectPaymentMethod,
        isQuoting,
        errorMessage,
        limits,
        isBestOffer,
        isMeld,
        senderAddress: senderAddress === '' ? null : senderAddress,
        isConfirming,
        handleOpenSourceSelection,
        handleOpenDestinationSelection,
        handleOpenProvider,
        handleOpenPaymentMethod,
        handleOpenSenderAddress,
        handleConfirm,
    }
}
