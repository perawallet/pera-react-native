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

import { useCallback, useState } from 'react'
import { Linking } from 'react-native'
import { type Decimal } from 'decimal.js'
import {
    useSelectedAccountAddress,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useCreateRampOrderMutation,
    useEnsureDestinationOptIn,
    useOnramp,
    toOnrampUserMessage,
    parseRampAmount,
    type RampPair,
    type RampQuote,
} from '@perawallet/wallet-core-onramp'
import {
    isConnectivityError,
    ZERO_DECIMAL,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { trackEvent, OnrampEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { OptInConfirmationContent } from '@modules/assets/components/OptInConfirmationContent'
import { OnrampOrderDetailsContent } from '../OnrampOrderDetailsContent'
import { OnrampTermsContent } from '../OnrampTermsContent'
import {
    buildPendingXoHistoryItem,
    resolveDestinationAssetId,
} from './onrampFormHelpers'
import { useOnrampTerms } from './useOnrampTerms'

type UseOnrampConfirmParams = {
    selectedPair: Nullable<RampPair>
    selectedQuote: Nullable<RampQuote>
    /** Raw source amount string from the form. */
    sourceAmount: string
    destinationAmount: Nullable<Decimal>
    isMeld: boolean
    /** Switch the screen to the History tab (after an XO order is placed). */
    onNavigateToHistory?: () => void
}

type UseOnrampConfirmResult = {
    isConfirming: boolean
    handleConfirm: () => Promise<void>
}

/**
 * Owns the "Buy" flow: the one-time Terms gate, destination opt-in (with its
 * confirmation sheet), order creation, and post-order routing (Meld widget vs
 * the XO review sheet). Split out of `useOnrampForm` so each concern reads on
 * its own; `sourceAmount` arrives already parsed (the caller gates Buy on a
 * valid amount).
 */
export const useOnrampConfirm = ({
    selectedPair,
    selectedQuote,
    sourceAmount,
    destinationAmount,
    isMeld,
    onNavigateToHistory,
}: UseOnrampConfirmParams): UseOnrampConfirmResult => {
    const { t } = useLanguage()
    const { network } = useNetwork()
    const { selectedAccountAddress } = useSelectedAccountAddress()
    const { senderAddress } = useOnramp()
    const { request: requestBottomSheet } = useBottomSheet()
    const { errorToast } = useToast()
    const { isTermsAccepted, markTermsAccepted } = useOnrampTerms()
    const { mutateAsync: createOrder } = useCreateRampOrderMutation()
    const { ensureOptIn } = useEnsureDestinationOptIn()

    const [isConfirming, setIsConfirming] = useState(false)

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

            const destinationAssetId = resolveDestinationAssetId(
                selectedPair,
                network,
            )

            // No known USDC id on this network — the destination asset is
            // unavailable here (a Pera-backed feature, already dead off that
            // lane). Nothing to opt into or fund, so bail out quietly.
            if (destinationAssetId === null) {
                return
            }

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
            if (isConnectivityError(error)) {
                errorToast(
                    t('errors.network.no_connection.title'),
                    t('errors.network.no_connection.body'),
                )
            } else {
                errorToast('', toOnrampUserMessage(error))
            }
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

    return { isConfirming, handleConfirm }
}
