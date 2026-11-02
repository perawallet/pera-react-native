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

import {
    PWRadioButton,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import {
    useOnrampPaymentMethodContent,
    type OnrampPaymentMethodContentProps,
} from './useOnrampPaymentMethodContent'

export type { OnrampPaymentMethodContentProps }

export const OnrampPaymentMethodContent = ({
    quotes,
    selectedPaymentMethodId,
}: OnrampPaymentMethodContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const { paymentMethods, highlightedId, selectPaymentMethod, handleApply } =
        useOnrampPaymentMethodContent({ quotes, selectedPaymentMethodId })

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
                        onPress={() => selectPaymentMethod(method.id)}
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
