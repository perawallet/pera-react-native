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

import { useCallback } from 'react'
import type { RampQuote } from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { trackEvent, OnrampEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { OnrampPairSelectionContent } from '../OnrampPairSelectionContent'
import { OnrampSourceSelectionContent } from '../OnrampSourceSelectionContent'
import { OnrampProviderContent } from '../OnrampProviderContent'
import { OnrampPaymentMethodContent } from '../OnrampPaymentMethodContent'
import { OnrampSenderAddressContent } from '../OnrampSenderAddressContent'

type UseOnrampSheetsParams = {
    quotes: RampQuote[]
    /** Raw source amount string — the provider sheet ranks XO quotes with it. */
    sourceAmount: string
    selectedQuoteId: Nullable<string>
    selectQuote: (quoteId: string) => void
    selectedPaymentMethodId: Nullable<string>
    selectPaymentMethod: (paymentMethodId: string) => void
    senderAddress: string
    setSelectedSourceTokenId: (id: string) => void
    setSelectedDestinationTokenId: (id: string) => void
    setSenderAddress: (address: string) => void
}

type UseOnrampSheetsResult = {
    handleOpenSourceSelection: () => Promise<void>
    handleOpenDestinationSelection: () => Promise<void>
    handleOpenProvider: () => Promise<void>
    handleOpenPaymentMethod: () => Promise<void>
    handleOpenSenderAddress: () => Promise<void>
}

/**
 * Sheet-open handlers for the onramp form. Each opens the relevant bottom-sheet
 * content and applies the resolved value back through the form's setters. Split
 * out of `useOnrampForm` to keep that hook under the max-lines threshold.
 *
 * The selection sheets resolve a TOKEN id (source or destination), which the
 * handler commits directly to the store; source and destination are now
 * independent (no pair is resolved here).
 */
export const useOnrampSheets = ({
    quotes,
    sourceAmount,
    selectedQuoteId,
    selectQuote,
    selectedPaymentMethodId,
    selectPaymentMethod,
    senderAddress,
    setSelectedSourceTokenId,
    setSelectedDestinationTokenId,
    setSenderAddress,
}: UseOnrampSheetsParams): UseOnrampSheetsResult => {
    const { request: requestBottomSheet } = useBottomSheet()

    const handleOpenSourceSelection = useCallback(async () => {
        const sourceTokenId = await requestBottomSheet<string>({
            contents: <OnrampSourceSelectionContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!sourceTokenId) return
        setSelectedSourceTokenId(sourceTokenId)
    }, [requestBottomSheet, setSelectedSourceTokenId])

    const handleOpenDestinationSelection = useCallback(async () => {
        const destinationTokenId = await requestBottomSheet<string>({
            contents: <OnrampPairSelectionContent variant='destination' />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!destinationTokenId) return
        setSelectedDestinationTokenId(destinationTokenId)
    }, [requestBottomSheet, setSelectedDestinationTokenId])

    const handleOpenProvider = useCallback(async () => {
        trackEvent(OnrampEvent.ProviderTap)
        const resolvedQuoteId = await requestBottomSheet<string>({
            contents: (
                <OnrampProviderContent
                    quotes={quotes}
                    sourceAmount={sourceAmount}
                    selectedQuoteId={selectedQuoteId}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (resolvedQuoteId) {
            trackEvent(OnrampEvent.ProviderSelect)
            selectQuote(resolvedQuoteId)
        }
    }, [requestBottomSheet, quotes, sourceAmount, selectedQuoteId, selectQuote])

    const handleOpenPaymentMethod = useCallback(async () => {
        const resolvedPaymentMethodId = await requestBottomSheet<string>({
            contents: (
                <OnrampPaymentMethodContent
                    quotes={quotes}
                    selectedPaymentMethodId={selectedPaymentMethodId}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (resolvedPaymentMethodId) {
            selectPaymentMethod(resolvedPaymentMethodId)
        }
    }, [
        requestBottomSheet,
        quotes,
        selectedPaymentMethodId,
        selectPaymentMethod,
    ])

    const handleOpenSenderAddress = useCallback(async () => {
        // XO-only: choose the source (sender) address for the swap order.
        trackEvent(OnrampEvent.SenderAddressOpen)
        const resolvedAddress = await requestBottomSheet<string>({
            contents: (
                <OnrampSenderAddressContent initialAddress={senderAddress} />
            ),
            options: {
                // Auto sheet: the content renders inline (SheetHeader + body +
                // in-body button), so it sizes to its content and grows with
                // the keyboard. autoCreateContainer defaults true to wrap it.
                size: 'auto',
                enablePanDownToClose: true,
            },
        })
        if (resolvedAddress) {
            trackEvent(OnrampEvent.SenderAddressApply)
            setSenderAddress(resolvedAddress)
        }
    }, [requestBottomSheet, senderAddress, setSenderAddress])

    return {
        handleOpenSourceSelection,
        handleOpenDestinationSelection,
        handleOpenProvider,
        handleOpenPaymentMethod,
        handleOpenSenderAddress,
    }
}
