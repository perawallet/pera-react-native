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

import type { Decimal } from 'decimal.js'
import { PWChip, PWRadioButton, PWText, PWView } from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { useLanguage } from '@hooks/useLanguage'
import {
    quoteDestinationAmount,
    quoteDestinationValueInUsd,
    type RampQuote,
} from '@perawallet/wallet-core-chain-algorand/onramp'
import {
    displayCurrencyToAssetId,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getOnrampDestinationCurrency } from '../onrampQuoteDisplay'
import { useStyles } from './styles'

/** `priceInUsd` on the ramp token is USD-denominated, so the value line is too. */
const USD_CURRENCY = 'USD'

export type ProviderSelectionItemProps = {
    label: string
    quote: RampQuote
    /** Raw source amount string — XO destination amounts are computed from it. */
    sourceAmount: string
    /** Destination token price in USD; null hides the fiat value line. */
    destinationPriceInUsd: Nullable<Decimal>
    isBest: boolean
    isSelected: boolean
    onPress: () => void
    testID?: string
}

export const ProviderSelectionItem = ({
    label,
    quote,
    sourceAmount,
    destinationPriceInUsd,
    isBest,
    isSelected,
    onPress,
    testID,
}: ProviderSelectionItemProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    // Provider quote currencies are trusted codes (Meld fiat/crypto codes, XO
    // asset ids), so the ALGO ticker may translate to the glyph-earning id.
    const destinationCurrency = getOnrampDestinationCurrency(quote)
    const destinationValueInUsd = quoteDestinationValueInUsd(
        quote,
        sourceAmount,
        destinationPriceInUsd,
    )

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
                    <CurrencyAmount
                        currency={destinationCurrency}
                        assetId={displayCurrencyToAssetId(destinationCurrency)}
                        value={quoteDestinationAmount(quote, sourceAmount)}
                        precision='compact'
                        showSymbol
                        alignRight
                        variant='body'
                        style={styles.amountText}
                    />
                    {destinationValueInUsd ? (
                        <CurrencyAmount
                            currency={USD_CURRENCY}
                            assetId={displayCurrencyToAssetId(USD_CURRENCY)}
                            value={destinationValueInUsd}
                            precision='compact'
                            showSymbol
                            alignRight
                            variant='caption'
                            style={styles.valueText}
                        />
                    ) : null}
                </PWView>
            </PWView>
        </PWRadioButton>
    )
}
