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

import { PWChip, PWRadioButton, PWText, PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { useLanguage } from '@hooks/useLanguage'
import {
    quoteDestinationAmount,
    type RampQuote,
} from '@perawallet/wallet-core-onramp'
import {
    getOnrampDestinationCurrency,
    getOnrampFeeCurrency,
    getOnrampTotalFee,
} from '../onrampQuoteDisplay'
import { useStyles } from './styles'

// Display precision for the destination amount and fee.
const AMOUNT_DECIMALS = 2

export type ProviderSelectionItemProps = {
    label: string
    quote: RampQuote
    /** Raw source amount string — XO destination amounts are computed from it. */
    sourceAmount: string
    isBest: boolean
    isSelected: boolean
    onPress: () => void
    testID?: string
}

export const ProviderSelectionItem = ({
    label,
    quote,
    sourceAmount,
    isBest,
    isSelected,
    onPress,
    testID,
}: ProviderSelectionItemProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWRadioButton
            isSelected={isSelected}
            onPress={onPress}
            testID={testID}
            containerStyle={styles.item}
        >
            {/* PWRadioButton lays its children in a column, so wrap the label
                and amount in a single row to keep them on one line. */}
            <PWView style={styles.itemRow}>
                <PWView style={styles.itemLeft}>
                    <PWText
                        variant='body'
                        style={styles.itemLabel}
                        truncate
                    >
                        {label}
                    </PWText>
                    {isBest ? (
                        <PWChip
                            title={t('onramp.provider.best_offer')}
                            variant='helper'
                        />
                    ) : null}
                </PWView>
                <PWView style={styles.rightColumn}>
                    <CurrencyDisplay
                        currency={getOnrampDestinationCurrency(quote)}
                        value={quoteDestinationAmount(quote, sourceAmount)}
                        precision={AMOUNT_DECIMALS}
                        showSymbol
                        alignRight
                        variant='body'
                        style={styles.amountText}
                    />
                    <CurrencyDisplay
                        currency={getOnrampFeeCurrency(quote)}
                        value={getOnrampTotalFee(quote)}
                        precision={AMOUNT_DECIMALS}
                        showSymbol
                        alignRight
                        variant='caption'
                        style={styles.feeText}
                    />
                </PWView>
            </PWView>
        </PWRadioButton>
    )
}
