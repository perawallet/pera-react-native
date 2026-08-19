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

import { PWChip, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type {
    RampPair,
    RampQuote,
    RampToken,
} from '@perawallet/wallet-core-onramp'
import { OnrampSelectionRow } from '../OnrampSelectionRow'
import {
    getOnrampPaymentMethodName,
    getOnrampProviderName,
} from '../onrampQuoteDisplay'
import { useStyles } from './styles'

const PLACEHOLDER_VALUE = '-'

export type OnrampFormDetailRowsProps = {
    selectedPair: Nullable<RampPair>
    selectedQuote: Nullable<RampQuote>
    isMeld: boolean
    isQuoteLoading: boolean
    isBestOffer: boolean
    senderAddress: Nullable<string>
    sourceToken: Nullable<RampToken>
    onOpenPaymentMethod: () => void
    onOpenProvider: () => void
    onOpenSenderAddress: () => void
}

export const OnrampFormDetailRows = ({
    selectedPair,
    selectedQuote,
    isMeld,
    isQuoteLoading,
    isBestOffer,
    senderAddress,
    sourceToken,
    onOpenPaymentMethod,
    onOpenProvider,
    onOpenSenderAddress,
}: OnrampFormDetailRowsProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    if (selectedPair === null) return null

    if (isMeld) {
        return (
            <PWView style={styles.rows}>
                <OnrampSelectionRow
                    label={t('onramp.form.payment_method')}
                    value={
                        selectedQuote
                            ? getOnrampPaymentMethodName(selectedQuote)
                            : PLACEHOLDER_VALUE
                    }
                    onPress={onOpenPaymentMethod}
                    isLoading={isQuoteLoading}
                    skeletonWidth={120}
                    testID='onramp-payment-method-row'
                />
                <OnrampSelectionRow
                    label={t('onramp.form.provider')}
                    value={
                        selectedQuote
                            ? getOnrampProviderName(selectedQuote)
                            : PLACEHOLDER_VALUE
                    }
                    onPress={onOpenProvider}
                    isLoading={isQuoteLoading}
                    skeletonWidth={90}
                    badge={
                        isBestOffer ? (
                            <PWChip
                                title={t('onramp.provider.best_offer')}
                                variant='helper'
                            />
                        ) : null
                    }
                    testID='onramp-provider-row'
                />
            </PWView>
        )
    }

    return (
        <PWView style={styles.senderRow}>
            <OnrampSelectionRow
                label={t('onramp.form.sender_address')}
                labelVariant='body'
                valueVariant='h4'
                value={
                    senderAddress ??
                    t('onramp.form.enter_sender_address', {
                        name: sourceToken?.name ?? sourceToken?.symbol ?? '',
                    })
                }
                isPlaceholder={!senderAddress}
                onPress={onOpenSenderAddress}
                testID='onramp-sender-address-row'
            />
        </PWView>
    )
}
