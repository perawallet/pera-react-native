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

import { PWChip, PWRadioButton, PWText, PWView } from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { useLanguage } from '@hooks/useLanguage'
import type { RampQuote } from '@perawallet/wallet-core-onramp'
import { useStyles } from './styles'
import { displayCurrencyToAssetId } from '@perawallet/wallet-core-assets'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'

/** The quote's USD values are USD-denominated, so the value line is too. */
const USD_CURRENCY = 'USD'

export type ProviderSelectionItemProps = {
    label: string
    quote: RampQuote
    /** The receive asset's symbol, which the amount is shown in. */
    destinationSymbol: string
    isBest: boolean
    isSelected: boolean
    onPress: () => void
    testID?: string
}

export const ProviderSelectionItem = ({
    label,
    quote,
    destinationSymbol,
    isBest,
    isSelected,
    onPress,
    testID,
}: ProviderSelectionItemProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    // The symbol comes from the router's asset, so the native ticker may
    // translate to the glyph-earning id.
    const chainId = useOnrampAccount().scope?.chainId ?? null
    const assetIdOf = (code: string) =>
        chainId === null ? null : displayCurrencyToAssetId(code, chainId)
    const { destinationValueInUsd } = quote

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
                        chainId={chainId}
                        currency={destinationSymbol}
                        assetId={assetIdOf(destinationSymbol)}
                        value={quote.destinationAmount}
                        precision='compact'
                        showSymbol
                        alignRight
                        variant='body'
                        style={styles.amountText}
                    />
                    {destinationValueInUsd ? (
                        <CurrencyAmount
                            chainId={chainId}
                            currency={USD_CURRENCY}
                            assetId={assetIdOf(USD_CURRENCY)}
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
