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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { RampQuote, RampToken } from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { AnalyticsMetadataKey, OnrampEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'
import { useTrackOnrampEvent } from '@modules/onramp/hooks/useTrackOnrampEvent'
import {
    OnrampPairSelectionContent,
    type OnrampDestinationPick,
} from '../OnrampPairSelectionContent'
import { OnrampSourceSelectionContent } from '../OnrampSourceSelectionContent'
import { OnrampProviderContent } from '../OnrampProviderContent'
import { OnrampPaymentMethodContent } from '../OnrampPaymentMethodContent'
import { OnrampSenderAddressContent } from '../OnrampSenderAddressContent'

type UseOnrampSheetsParams = {
    quotes: RampQuote[]
    selectedQuoteId: Nullable<string>
    selectQuote: (quoteId: string) => void
    selectedPaymentMethodId: Nullable<string>
    selectPaymentMethod: (paymentMethodId: string) => void
    /** The receive asset's symbol, which the provider rows show their amounts in. */
    destinationSymbol: string
    senderAddress: string
    /** The current pay asset; the sender address belongs to its chain. */
    sourceToken: Nullable<RampToken>
    setSelectedSourceTokenId: (id: string) => void
    setSelectedDestinationTokenId: (id: string) => void
    setSelectedChainId: (chainId: ChainId) => void
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
 * The source sheet resolves a token and the destination sheet a destination
 * pick (chain and token id); the handler commits either directly to the store,
 * with no pair resolved here.
 */
export const useOnrampSheets = ({
    quotes,
    selectedQuoteId,
    selectQuote,
    selectedPaymentMethodId,
    selectPaymentMethod,
    destinationSymbol,
    senderAddress,
    sourceToken,
    setSelectedSourceTokenId,
    setSelectedDestinationTokenId,
    setSelectedChainId,
    setSenderAddress,
}: UseOnrampSheetsParams): UseOnrampSheetsResult => {
    const { request: requestBottomSheet } = useBottomSheet()
    const { scope } = useOnrampAccount()
    const trackOnrampEvent = useTrackOnrampEvent()

    const handleOpenSourceSelection = useCallback(async () => {
        const picked = await requestBottomSheet<RampToken>({
            contents: <OnrampSourceSelectionContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!picked) return
        // An address on the old source's chain is wrong for the new one.
        if (picked.id !== sourceToken?.id) setSenderAddress('')
        setSelectedSourceTokenId(picked.id)
        trackOnrampEvent(
            OnrampEvent.SourceSelect,
            picked.network.name === ''
                ? undefined
                : { [AnalyticsMetadataKey.SourceChain]: picked.network.name },
        )
    }, [
        requestBottomSheet,
        setSelectedSourceTokenId,
        setSenderAddress,
        sourceToken?.id,
        trackOnrampEvent,
    ])

    const handleOpenDestinationSelection = useCallback(async () => {
        if (scope === null) return
        const pick = await requestBottomSheet<OnrampDestinationPick>({
            contents: (
<OnrampPairSelectionContent scope={scope} />
            ),
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!pick) return
        setSelectedChainId(pick.chainId)
        setSelectedDestinationTokenId(pick.tokenId)
        trackOnrampEvent(OnrampEvent.DestinationSelect)
    }, [
        requestBottomSheet,
        setSelectedChainId,
        setSelectedDestinationTokenId,
        scope,
        trackOnrampEvent,
    ])

    const handleOpenProvider = useCallback(async () => {
        trackOnrampEvent(OnrampEvent.ProviderTap)
        const resolvedQuoteId = await requestBottomSheet<string>({
            contents: (
                <OnrampProviderContent
                    quotes={quotes}
                    selectedQuoteId={selectedQuoteId}
                    selectedPaymentMethodId={selectedPaymentMethodId}
                    destinationSymbol={destinationSymbol}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (resolvedQuoteId) {
            trackOnrampEvent(OnrampEvent.ProviderSelect)
            selectQuote(resolvedQuoteId)
        }
    }, [
        requestBottomSheet,
        quotes,
        selectedQuoteId,
        selectedPaymentMethodId,
        destinationSymbol,
        selectQuote,
        trackOnrampEvent,
    ])

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
        if (sourceToken === null) return
        trackOnrampEvent(OnrampEvent.SenderAddressOpen)
        const resolvedAddress = await requestBottomSheet<string>({
            contents: (
                <OnrampSenderAddressContent
                    initialAddress={senderAddress}
                    sourceToken={sourceToken}
                />
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
            trackOnrampEvent(OnrampEvent.SenderAddressApply)
            setSenderAddress(resolvedAddress)
        }
    }, [
        requestBottomSheet,
        senderAddress,
        setSenderAddress,
        sourceToken,
        trackOnrampEvent,
    ])

    return {
        handleOpenSourceSelection,
        handleOpenDestinationSelection,
        handleOpenProvider,
        handleOpenPaymentMethod,
        handleOpenSenderAddress,
    }
}
