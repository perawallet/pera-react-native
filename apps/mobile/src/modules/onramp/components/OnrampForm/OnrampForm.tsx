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

import { PWButton, PWScrollView, PWText, PWView } from '@components/core'
import { trackEvent, OnrampEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { RampPair, RampToken } from '@perawallet/wallet-core-onramp'
import { OnrampAmountFields } from './OnrampAmountFields'
import { OnrampFormDetailRows } from './OnrampFormDetailRows'
import { useOnrampForm } from './useOnrampForm'
import { useStyles } from './styles'

export type OnrampFormProps = {
    sourceToken: Nullable<RampToken>
    destinationToken: Nullable<RampToken>
    selectedPair: Nullable<RampPair>
    /** Switch the screen to the History tab (after an XO order is placed). */
    onNavigateToHistory?: () => void
}

export const OnrampForm = ({
    sourceToken,
    destinationToken,
    selectedPair,
    onNavigateToHistory,
}: OnrampFormProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        sourceAmount,
        setSourceAmount,
        destinationAmount,
        selectedQuote,
        isQuoting,
        errorMessage,
        limits,
        isBestOffer,
        isMeld,
        senderAddress,
        isConfirming,
        handleOpenSourceSelection,
        handleOpenDestinationSelection,
        handleOpenProvider,
        handleOpenPaymentMethod,
        handleOpenSenderAddress,
        handleConfirm,
    } = useOnrampForm(selectedPair, onNavigateToHistory)

    const hasValidQuote = selectedQuote !== null && sourceAmount !== ''
    const canConfirm =
        hasValidQuote &&
        destinationAmount !== null &&
        errorMessage === null &&
        // XO rejects orders without a sender address, so it is mandatory there.
        (isMeld || senderAddress !== null) &&
        !isConfirming

    const handleOpenSource = () => {
        trackEvent(OnrampEvent.TopCurrencyTap)
        void handleOpenSourceSelection()
    }

    const handleOpenDestination = () => {
        trackEvent(OnrampEvent.BottomCurrencyTap)
        void handleOpenDestinationSelection()
    }

    return (
        <PWScrollView contentContainerStyle={styles.formContainer}>
            <OnrampAmountFields
                sourceToken={sourceToken}
                destinationToken={destinationToken}
                sourceAmount={sourceAmount}
                destinationAmount={destinationAmount}
                limits={limits}
                isReceiveLoading={isQuoting}
                onSourceAmountChange={setSourceAmount}
                onSetSourceAmount={setSourceAmount}
                onOpenSource={handleOpenSource}
                onOpenDestination={handleOpenDestination}
            />

            {/* The quote-dependent rows (provider, payment method) skeleton
                whenever a quote is in flight — including a re-quote after an
                amount change, where a stale quote is still shown — so there's
                always a loading indication. */}
            <OnrampFormDetailRows
                selectedPair={selectedPair}
                selectedQuote={selectedQuote}
                isMeld={isMeld}
                isQuoteLoading={isQuoting}
                isBestOffer={isBestOffer}
                senderAddress={senderAddress}
                sourceToken={sourceToken}
                onOpenPaymentMethod={() => void handleOpenPaymentMethod()}
                onOpenProvider={() => void handleOpenProvider()}
                onOpenSenderAddress={() => void handleOpenSenderAddress()}
            />

            {!!errorMessage && (
                <PWView style={styles.errorContainer}>
                    <PWText
                        variant='body'
                        style={styles.errorText}
                    >
                        {errorMessage}
                    </PWText>
                </PWView>
            )}

            <PWButton
                variant='primary'
                title={t('onramp.form.proceed')}
                onPress={() => void handleConfirm()}
                isDisabled={!canConfirm}
                isLoading={isConfirming}
                style={styles.buyButton}
                testID='onramp-buy-button'
            />
        </PWScrollView>
    )
}
