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

import { useCallback, useMemo, useState } from 'react'
import {
    PWRadioButton,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { RampQuote } from '@perawallet/wallet-core-onramp'
import { useStyles } from './styles'

export type OnrampPaymentMethodContentProps = {
    quotes: RampQuote[]
    selectedPaymentMethodId: Nullable<string>
}

type PaymentMethodOption = {
    id: string
    name: string
}

// Quotes can repeat payment methods across providers; show each method once.
const distinctPaymentMethods = (quotes: RampQuote[]): PaymentMethodOption[] => {
    const seen = new Set<string>()
    const methods: PaymentMethodOption[] = []
    for (const quote of quotes) {
        const { id, name } = quote.paymentMethod
        if (seen.has(id)) continue
        seen.add(id)
        methods.push({ id, name })
    }
    return methods
}

export const OnrampPaymentMethodContent = ({
    quotes,
    selectedPaymentMethodId,
}: OnrampPaymentMethodContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { resolve } = useBottomSheetResult<string>()

    const paymentMethods = useMemo(
        () => distinctPaymentMethods(quotes),
        [quotes],
    )

    const [highlightedId, setHighlightedId] = useState<Nullable<string>>(
        selectedPaymentMethodId ?? paymentMethods[0]?.id ?? null,
    )

    const handleApply = useCallback(() => {
        if (highlightedId) {
            resolve(highlightedId)
        }
    }, [highlightedId, resolve])

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('onramp.payment_method.title')}
                    rightAction={
                        <PWTouchableOpacity
                            onPress={handleApply}
                            testID='onramp-payment-method-apply'
                        >
                            <PWText
                                variant='body'
                                style={styles.apply}
                            >
                                {t('onramp.payment_method.apply')}
                            </PWText>
                        </PWTouchableOpacity>
                    }
                />
            }
        >
            <PWView style={styles.list}>
                {paymentMethods.map(method => (
                    <PWRadioButton
                        key={method.id}
                        isSelected={method.id === highlightedId}
                        onPress={() => setHighlightedId(method.id)}
                        containerStyle={styles.item}
                        testID={`onramp-payment-method-option-${method.id}`}
                    >
                        <PWText
                            variant='body'
                            style={styles.itemLabel}
                            truncate
                        >
                            {method.name}
                        </PWText>
                    </PWRadioButton>
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
